defmodule GitGame.Resolver do
  @moduledoc """
  The remote's one job (round-resolution §3): when a day closes, resolve every pack of the day and open the next.
  Pure: a game and the day's packs in, the next game and the day log out. No clock, no database, no randomness
  except the game's seed, so a game replays exactly from its seed and its packs.

  Absence is a rule, not an error (charter decision 6): no pack by the time the day closes is an empty pack, and after
  `left_the_company_after_consecutive_empty_days` of them in a row the player has left the company. They send no more
  packs and draw no more cards, but their commits stay on `main` and still take blame at the release.

  In the order `rules/online.json` names. `batch_at_close` (ADR-0003) resolves whole packs in an order shuffled from
  the seed and the day, whatever order they arrived in; `arrival` resolves them in the order given.

  A pack runs op by op until its budget is spent: each op costs what `GitGame.Ops.cost/3` says at the moment it runs;
  an op that no longer fits the remaining budget is not run, and the pack stops there. A failed op still costs its
  ops, unless the rules say otherwise.
  """
  alias GitGame.{Game, Ops, Release, Seeded}

  @doc "Opens the next day: the incident flips, and everyone draws."
  def open_day(%Game{released: nil} = game) do
    day = game.day + 1
    incident = Seeded.pick(game.rules.incidents, game.seed, {:incident, day})
    game = %{game | day: day, incident: incident, rolled: false}

    {game, drew} =
      Enum.reduce(present(game), {game, []}, fn id, {g, drew} ->
        {cards, pile} = Enum.split(g.draw_pile, g.rules.draw)

        g =
          %{g | draw_pile: pile}
          |> Game.put_player(id, %{g.players[id] | hand: g.players[id].hand ++ cards})

        {g, drew ++ [%{type: :drew, player: id, cards: cards}]}
      end)

    {game, [%{type: :day_opened, day: day, incident: incident.id, budget: budget(game)} | drew]}
  end

  @doc """
  Closes the day: resolves `packs` (a list of `{player, pack}`, in the order they arrived), applies the hand limit,
  runs CI if this was the final day, and opens the next day unless the game is over. A pack is a list of ops, or a
  map `%{ops: [...], discard: [card ids]}` that also declares which cards to give up to the hand limit.
  """
  def close_day(%Game{released: nil} = game, packs) do
    # someone who has left the company sends nothing more: anything that arrives from them is ignored
    arrived = for {id, _} <- packs, id in present(game), uniq: true, do: id

    packs =
      packs
      |> Enum.filter(fn {id, _} -> id in arrived end)
      |> Map.new(fn {id, pack} -> {id, normalize(pack)} end)

    {game, absences} = absence(game, arrived)

    {game, log} =
      Enum.reduce(order(game, arrived), {game, absences}, fn id, {g, log} ->
        if g.released,
          do: {g, log},
          else: run_pack(g, id, Map.get(packs, id, %{ops: [], discard: []}), log)
      end)

    {game, log} = if game.released, do: {game, log}, else: hand_limit(game, packs, log)

    {game, log} =
      if !game.released and game.day >= game.final_day, do: final_ci(game, log), else: {game, log}

    log = log ++ [%{type: :day_closed, day: game.day}]

    if game.released,
      do: {game, log},
      else: open_day(game) |> then(fn {g, opened} -> {g, log ++ opened} end)
  end

  defp present(game), do: Enum.reject(game.seats, &game.players[&1].left)

  # A pack that arrived resets a player's run of empty days; no pack extends it, and a long enough run is leaving.
  defp absence(game, arrived) do
    Enum.reduce(present(game), {game, []}, fn id, {g, log} ->
      p = g.players[id]
      run = p.empty_days + 1

      cond do
        id in arrived ->
          {Game.put_player(g, id, %{p | empty_days: 0}), log}

        run >= g.rules.left_after_empty_days ->
          left = [
            %{type: :empty_pack, player: id, in_a_row: run},
            %{type: :left_the_company, player: id}
          ]

          {Game.put_player(g, id, %{p | empty_days: run, left: true}), log ++ left}

        true ->
          {Game.put_player(g, id, %{p | empty_days: run}),
           log ++ [%{type: :empty_pack, player: id, in_a_row: run}]}
      end
    end)
  end

  defp normalize(ops) when is_list(ops), do: %{ops: ops, discard: []}

  defp normalize(%{} = pack),
    do: %{ops: Map.get(pack, :ops, []), discard: Map.get(pack, :discard, [])}

  # Everyone who sent a pack, and everyone who didn't: an empty pack resolves too (and is where absence is noticed).
  defp order(game, arrived) do
    case game.rules.resolution_order do
      :batch_at_close ->
        game
        |> present()
        |> Seeded.shuffle(Seeded.stream(game.seed, {:order, game.day}))
        |> elem(0)

      :arrival ->
        arrived ++ (present(game) -- arrived)
    end
  end

  # The day's ops budget: the rules' budget, unless the incident says otherwise (Standup Ran Long, Hackathon).
  @doc "The day's ops budget: the rules' budget, unless the incident says otherwise."
  def budget(%Game{incident: %{effect: %{kind: :ops, ops: ops}}}), do: ops
  def budget(game), do: game.rules.ops_budget

  defp run_pack(game, id, pack, log) do
    opened = %{type: :pack_opened, player: id, budget: budget(game), ops: length(pack.ops)}
    ops = Enum.take(pack.ops, game.rules.pack_max_ops)

    {game, left, events} =
      Enum.reduce_while(ops, {game, budget(game), []}, fn op, {g, left, events} ->
        cost = Ops.cost(g, id, op)

        cond do
          g.released ->
            {:halt, {g, left, events}}

          cost > left ->
            skipped = %{
              type: :op_skipped,
              player: id,
              op: op.op,
              message: "not run: it costs #{cost} and #{left} is left"
            }

            {:halt, {g, left, events ++ with_why([skipped], id, op)}}

          true ->
            {result, g, happened} = Ops.run(g, id, op)
            spent = if result == :failed and not g.rules.failed_op_costs, do: 0, else: cost
            {:cont, {g, left - spent, events ++ with_why(happened, id, op)}}
        end
      end)

    {game,
     log ++ [opened | events] ++ [%{type: :pack_closed, player: id, spent: budget(game) - left}]}
  end

  # An op may say why it was played (a bot's reasoning, M14b); its own events carry that, and nobody else's: a reflog
  # that fires inside someone's force-push is its owner's event, not theirs.
  defp with_why(events, id, %{why: why}) when is_binary(why),
    do: Enum.map(events, &if(&1[:player] == id, do: Map.put(&1, :why, why), else: &1))

  defp with_why(events, _id, _op), do: events

  # At the end of the day nobody keeps more than the hand limit. The pack may say what to give up; whatever it doesn't
  # cover goes by a fixed, public rule: the smallest commit cards first, bugs before clean ones, command cards last.
  defp hand_limit(game, packs, log) do
    Enum.reduce(game.seats, {game, log}, fn id, {g, log} ->
      p = g.players[id]
      over = length(p.hand) - g.rules.hand_limit

      if over <= 0 do
        {g, log}
      else
        declared =
          for cid <- Map.get(packs, id, %{discard: []}).discard,
              card = Enum.find(p.hand, &(&1.id == cid)),
              do: card

        declared = declared |> Enum.uniq() |> Enum.take(over)

        rest =
          (p.hand -- declared)
          |> Enum.sort_by(&keep_value/1)
          |> Enum.take(over - length(declared))

        gone = declared ++ rest
        g = g |> Game.put_player(id, %{p | hand: p.hand -- gone}) |> Game.discard(gone)
        {g, log ++ [%{type: :hand_limit, player: id, discarded: gone}]}
      end
    end)
  end

  defp keep_value(%{kind: :command}), do: {2, 0}
  defp keep_value(%{kind: :commit, bug: true, lines: n}), do: {0, n}
  defp keep_value(%{kind: :commit, lines: n}), do: {1, n}

  # The release date does not move: the final day runs CI when it closes, tagged or not.
  defp final_ci(game, log) do
    {game, ci} = Release.ci(game, nil)
    {game, log ++ [ci]}
  end
end
