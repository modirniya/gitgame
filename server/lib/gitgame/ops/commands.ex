defmodule GitGame.Ops.Commands do
  @moduledoc """
  The command cards switched on for online play (`rules/online.json`): `blame`, `revert` and `push --force`, with the
  `reflog` trap firing inside a force-push (round-resolution §3). A command needs its card in hand and is spent only
  when it works; a failed command still costs its op, and its card stays in hand (rules v0.2).
  """
  @behaviour GitGame.Ops
  import GitGame.Ops, only: [failed: 4]
  import GitGame.Game, only: [put_player: 3, behind_by: 2]
  alias GitGame.Seeded

  @cards %{blame: "blame", revert: "revert", force: "force"}

  @impl true
  def cost(game, _player, %{op: op}), do: game.rules.commands[@cards[op]].cost

  @impl true
  def run(game, player, %{op: op} = o) do
    cond do
      game.incident && game.incident.effect.kind == :no_commands ->
        failed(game, player, op, "error: #{game.incident.name}: no command cards today")

      card_in_hand(game, player, @cards[op]) == nil ->
        failed(game, player, op, "error: no #{game.rules.commands[@cards[op]].name} card in hand")

      true ->
        play(game, player, o)
    end
  end

  # ---------- git blame: flip one face-down commit; a live bug counts against its author ----------

  defp play(game, player, %{op: :blame, target: sha}) do
    commit = find(game, sha)

    cond do
      commit == nil || commit[:initial] || commit[:revert_of] ->
        failed(game, player, :blame, "fatal: no such commit #{sha} on main")

      commit.flipped ->
        failed(game, player, :blame, "error: #{sha} is already face-up")

      true ->
        bug = live_bug?(commit)
        game = update_commit(game, sha, &Map.merge(&1, %{flipped: true, blamed: bug}))
        game = if bug, do: update_in(game.players[commit.author].blame, &(&1 + 1)), else: game

        {:ok, spend(game, player, "blame"),
         [%{type: :blamed, player: player, target: sha, author: commit.author, bug: bug}]}
    end
  end

  # ---------- git revert: a commit on top of main that neutralises a flipped bug ----------

  defp play(game, player, %{op: :revert, target: sha}) do
    commit = find(game, sha)

    cond do
      behind_by(game, player) > 0 ->
        failed(game, player, :revert, "! [rejected]        main -> main (non-fast-forward)")

      commit == nil or not commit.flipped or not live_bug?(commit) ->
        failed(game, player, :revert, "error: #{sha} is not a face-up bug")

      true ->
        revert = %{
          id: Seeded.sha(game.seed, game.next_commit),
          author: player,
          cards: [],
          revert_of: sha,
          flipped: true,
          message: ~s(Revert "#{commit[:message] || sha}")
        }

        game =
          update_commit(
            %{game | next_commit: game.next_commit + 1},
            sha,
            &Map.put(&1, :reverted, true)
          )

        game = %{game | main: game.main ++ [revert]}
        p = game.players[player]
        game = put_player(game, player, %{p | pointer: length(game.main), fixes: p.fixes + 1})

        {:ok, spend(game, player, "revert"),
         [
           %{
             type: :reverted,
             player: player,
             target: sha,
             revert: revert.id,
             message: "[main #{revert.id}] #{revert.message}"
           }
         ]}
    end
  end

  # ---------- git push --force: main back to your pointer, your commits on top, and a sin ----------

  defp play(game, player, %{op: :force}) do
    if behind_by(game, player) == 0 do
      failed(game, player, :force, "error: nothing ahead of your pointer to overwrite")
    else
      force(spend(game, player, "force"), player)
    end
  end

  defp force(game, player) do
    p = game.players[player]
    at = p.pointer
    old_tip = List.last(game.main).id
    {kept, erased} = Enum.split(game.main, at)
    main = kept ++ p.local
    players = Map.new(game.players, fn {id, q} -> {id, %{q | pointer: min(q.pointer, at)}} end)
    game = %{game | main: main, players: players}

    game =
      put_player(game, player, %{
        game.players[player]
        | local: [],
          sins: p.sins + 1,
          pointer: length(main)
      })

    # One armed reflog restores everything of its owner's that was erased, on top, in order; it fires now, inside
    # someone else's pack, and is spent. Everyone else's erased commits go back to their local branches.
    trapped =
      erased
      |> Enum.map(& &1.author)
      |> Enum.uniq()
      |> Enum.filter(&(&1 != player and "reflog" in game.players[&1].armed))

    game =
      Enum.reduce(trapped, game, fn v, g ->
        update_in(g.players[v].armed, &List.delete(&1, "reflog"))
      end)

    {game, returned, revived} = Enum.reduce(erased, {game, [], []}, &put_back(&1, &2, trapped))

    forced = %{
      type: :forced,
      player: player,
      erased: Enum.map(erased, & &1.id),
      pushed: Enum.map(p.local, & &1.id),
      returned: returned,
      revived: revived,
      message: " + #{old_tip}...#{List.last(game.main).id} main -> main (forced update)"
    }

    fired =
      for v <- trapped,
          do: %{
            type: :reflog_fired,
            player: v,
            restored: for(c <- erased, c.author == v, do: c.id)
          }

    {:ok, game, [forced | fired]}
  end

  defp put_back(commit, {game, returned, revived}, trapped) do
    cond do
      commit.author in trapped ->
        game = %{game | main: game.main ++ [commit]}
        {put_in(game.players[commit.author].pointer, length(game.main)), returned, revived}

      commit[:revert_of] ->
        game = update_commit(game, commit.revert_of, &Map.put(&1, :reverted, false))

        {update_in(game.players[commit.author].fixes, &max(&1 - 1, 0)), returned,
         revived ++ [commit.revert_of]}

      commit[:overwritten] ->
        {game, returned, revived}

      true ->
        {update_in(game.players[commit.author].local, &(&1 ++ [commit])), returned ++ [commit.id],
         revived}
    end
  end

  # ---------- helpers ----------

  # A bug that still counts: not overwritten by a conflict, not reverted.
  defp live_bug?(commit),
    do: Enum.any?(commit.cards, & &1.bug) and !commit[:overwritten] and !commit[:reverted]

  defp find(game, sha), do: Enum.find(game.main, &(&1.id == sha))

  defp update_commit(game, sha, f),
    do: %{game | main: Enum.map(game.main, &if(&1.id == sha, do: f.(&1), else: &1))}

  defp card_in_hand(game, player, command),
    do: Enum.find(game.players[player].hand, &(&1[:command] == command))

  defp spend(game, player, command) do
    card = card_in_hand(game, player, command)

    game
    |> update_in([Access.key!(:players), player, Access.key!(:hand)], &List.delete(&1, card))
    |> GitGame.Game.discard(card)
  end
end
