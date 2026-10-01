defmodule GitGame.Ops.Remote do
  @moduledoc """
  `push`, `pull` and `pull --rebase`: the ops that meet everyone else's work on `main` (round-resolution §3).

  Both are free when there is nothing to do. A push from behind is rejected and still paid for. A pull that brings in
  a commit touching the same file as one of your unpushed commits is a conflict, settled by the strategy declared on
  the op, because nobody is there to answer a prompt: `ours` overwrites their commit and takes a grudge, `theirs` drops
  yours, `resolve` keeps both for an extra op. A plain pull takes a merge token only if it actually merged something of
  yours; with nothing of yours it is a fast-forward, and Git makes no merge commit.
  """
  @behaviour GitGame.Ops
  import GitGame.Ops, only: [failed: 4]
  import GitGame.Game, only: [put_player: 3, behind_by: 2]
  alias GitGame.Seeded

  @rejected "! [rejected]        main -> main (non-fast-forward)"

  @impl true
  def cost(game, player, %{op: :push}) do
    if game.players[player].local == [],
      do: game.rules.op_costs.push_with_nothing_to_push,
      else: game.rules.op_costs.push
  end

  def cost(game, player, %{op: :pull} = op) do
    costs = game.rules.op_costs

    cond do
      behind_by(game, player) == 0 ->
        costs.pull_when_up_to_date

      true ->
        if(op[:rebase], do: costs.pull_rebase, else: costs.pull) + resolve_extra(game, player, op)
    end
  end

  defp resolve_extra(game, player, op) do
    if strategy(game, op) == :resolve and conflicts(game, player) != [],
      do: game.rules.op_costs.resolve_by_hand_extra,
      else: 0
  end

  @impl true
  def run(game, player, %{op: :push}) do
    p = game.players[player]

    cond do
      p.local == [] ->
        {:ok, game, [%{type: :push_up_to_date, player: player, message: "Everything up-to-date"}]}

      behind_by(game, player) > 0 ->
        failed(game, player, :push, @rejected)

      flaky_roll(game) ->
        flaky(game, player)

      true ->
        land(%{game | rolled: game.rolled or flaky?(game)}, player)
    end
  end

  def run(game, player, %{op: :pull} = op) do
    if behind_by(game, player) == 0 do
      {:ok, game, [%{type: :pull_up_to_date, player: player, message: "Already up to date."}]}
    else
      pull(game, player, !!op[:rebase], strategy(game, op))
    end
  end

  defp land(game, player) do
    p = game.players[player]
    from = List.last(game.main).id
    main = game.main ++ p.local
    game = put_player(%{game | main: main}, player, %{p | local: [], pointer: length(main)})
    tip = List.last(main).id

    {:ok, game,
     [
       %{
         type: :push_accepted,
         player: player,
         commits: Enum.map(p.local, & &1.id),
         message: "   #{from}..#{tip}  main -> main"
       }
     ]}
  end

  # Flaky CI: the day's first push rolls the die; a low roll rejects it, and the op is spent all the same.
  defp flaky?(game),
    do: match?(%{effect: %{kind: :flaky_first_push}}, game.incident) and not game.rolled

  defp flaky_roll(game) do
    flaky?(game) and
      Seeded.roll(game.incident.effect.die, game.seed, {:flaky, game.day}) <=
        game.incident.effect.rejected_at_or_below
  end

  defp flaky(game, player) do
    roll = Seeded.roll(game.incident.effect.die, game.seed, {:flaky, game.day})

    {:failed, %{game | rolled: true},
     [
       %{
         type: :op_failed,
         player: player,
         op: :push,
         message: "CI failed: flaky build (rolled #{roll})"
       }
     ]}
  end

  defp pull(game, player, rebase, strategy) do
    before = game.players[player]
    found = conflicts(game, player)
    incoming = Enum.drop(game.main, before.pointer)
    {game, p, settled} = settle(game, player, before, found, strategy, rebase)
    merged = p.local != []

    # The token is a rule, not Git's words: a merge whose -X theirs dropped all of yours still prints a merge, but
    # nothing of yours was merged, so it takes no token.
    token =
      cond do
        rebase -> game.rules.merge_token_on_rebase
        game.rules.merge_token_on_plain_pull == :always -> true
        true -> merged
      end

    p = %{p | pointer: length(game.main), merge: p.merge + if(token, do: 1, else: 0)}

    pulled = %{
      type: :pulled,
      player: player,
      rebase: rebase,
      incoming: Enum.map(incoming, & &1.id),
      merge_token: token,
      message: pulled_message(before.local, before.local -- p.local, rebase)
    }

    {:ok, put_player(game, player, p), settled ++ [pulled]}
  end

  # Git's words depend on what you had before the pull: with nothing of yours it fast-forwards, even under --rebase.
  defp pulled_message([], _dropped, _rebase), do: "Fast-forward"

  defp pulled_message(_local, dropped, true) do
    drops =
      for c <- dropped, do: "dropping #{c.id} #{c.message} -- patch contents already upstream"

    Enum.join(drops ++ ["Successfully rebased and updated refs/heads/main."], "\n")
  end

  defp pulled_message(_local, _dropped, false), do: "Merge made by the 'ort' strategy."

  # Every pair of one of your unpushed commits and an incoming commit that touch a file in common.
  defp conflicts(game, player) do
    p = game.players[player]

    incoming =
      game.main |> Enum.drop(p.pointer) |> Enum.reject(&(&1[:overwritten] || &1[:revert_of]))

    for mine <- p.local,
        theirs <- incoming,
        files = shared(mine, theirs),
        files != [],
        do: %{mine: mine.id, theirs: theirs.id, files: files}
  end

  defp shared(a, b), do: MapSet.intersection(files(a), files(b)) |> Enum.sort()
  defp files(commit), do: MapSet.new(commit.cards, & &1.file)

  defp strategy(game, op), do: op[:strategy] || game.rules.default_conflict_strategy

  defp settle(game, _player, p, [], _strategy, _rebase), do: {game, p, []}

  defp settle(game, player, p, found, strategy, rebase) do
    detected = %{
      type: :conflict_detected,
      player: player,
      conflicts: found,
      message: conflict_message(found, strategy, rebase, p.local)
    }

    {game, p, crossed, dropped} =
      Enum.reduce(found, {game, p, [], []}, fn %{mine: mine, theirs: theirs},
                                               {g, p, crossed, dropped} ->
        cond do
          strategy == :ours and theirs not in crossed ->
            {overwrite(g, theirs), %{p | grudges: p.grudges + 1}, crossed ++ [theirs], dropped}

          strategy == :theirs and mine not in dropped ->
            # a dropped commit's cards leave play
            gone = Enum.find(p.local, &(&1.id == mine))

            {GitGame.Game.discard(g, gone.cards), %{p | local: List.delete(p.local, gone)},
             crossed, dropped ++ [mine]}

          true ->
            {g, p, crossed, dropped}
        end
      end)

    resolved = %{
      type: :conflict_resolved,
      player: player,
      strategy: strategy,
      crossed_out: crossed,
      discarded: dropped
    }

    {game, p, [detected, resolved]}
  end

  # Overwritten: the commit stays on main, crossed out and face-up, and no longer counts for its author.
  defp overwrite(game, sha) do
    %{
      game
      | main:
          Enum.map(
            game.main,
            &if(&1.id == sha, do: Map.merge(&1, %{overwritten: true, flipped: true}), else: &1)
          )
    }
  end

  # What Git prints as the pull meets the clash. Under -X, Git settles each file itself: a merge says `Auto-merging`,
  # a rebase says nothing until it drops or keeps your commit. Resolving by hand stops on the CONFLICT: a merge once
  # for every file, a rebase at each of your clashing commits in turn.
  defp conflict_message(found, strategy, rebase, local) do
    lines =
      case {strategy, rebase} do
        {:resolve, false} ->
          Enum.flat_map(clashing(found), &stopped_on/1) ++
            ["Automatic merge failed; fix conflicts and then commit the result."]

        {:resolve, true} ->
          Enum.flat_map(local, fn c ->
            case clashing(Enum.filter(found, &(&1.mine == c.id))) do
              [] ->
                []

              files ->
                Enum.flat_map(files, &stopped_on/1) ++
                  ["error: could not apply #{c.id}... #{c.message}"]
            end
          end)

        {_, false} ->
          Enum.map(clashing(found), &"Auto-merging #{&1}")

        {_, true} ->
          []
      end

    Enum.join(lines, "\n")
  end

  # in path order, as Git reports them
  defp clashing(found), do: found |> Enum.flat_map(& &1.files) |> Enum.uniq() |> Enum.sort()

  defp stopped_on(file),
    do: ["Auto-merging #{file}", "CONFLICT (content): Merge conflict in #{file}"]
end
