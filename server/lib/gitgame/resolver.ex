defmodule GitGame.Resolver do
  @moduledoc """
  The remote's one job (round-resolution §3): when a day closes, resolve every pack of the day and open the next.
  Pure: a game and the day's packs in, the next game and the day log out. No clock, no database, no randomness
  except the game's seed, so a game replays exactly from its seed and its packs.

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
      Enum.reduce(game.seats, {game, []}, fn id, {g, drew} ->
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
    arrived = for {id, _} <- packs, id in game.seats, uniq: true, do: id
    packs = Map.new(packs, fn {id, pack} -> {id, normalize(pack)} end)

    {game, log} =
      Enum.reduce(order(game, arrived), {game, []}, fn id, {g, log} ->
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

  defp normalize(ops) when is_list(ops), do: %{ops: ops, discard: []}

  defp normalize(%{} = pack),
    do: %{ops: Map.get(pack, :ops, []), discard: Map.get(pack, :discard, [])}

  # Everyone who sent a pack, and everyone who didn't: an empty pack resolves too (and is where absence is noticed).
  defp order(game, arrived) do
    case game.rules.resolution_order do
      :batch_at_close ->
        game.seats |> Seeded.shuffle(Seeded.stream(game.seed, {:order, game.day})) |> elem(0)

      :arrival ->
        arrived ++ (game.seats -- arrived)
    end
  end

  # The day's ops budget: the rules' budget, unless the incident says otherwise (Standup Ran Long, Hackathon).
  defp budget(%Game{incident: %{effect: %{kind: :ops, ops: ops}}}), do: ops
  defp budget(game), do: game.rules.ops_budget

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
            {:halt,
             {g, left,
              events ++
                [
                  %{
                    type: :op_skipped,
                    player: id,
                    op: op.op,
                    message: "not run: it costs #{cost} and #{left} is left"
                  }
                ]}}

          true ->
            {result, g, happened} = Ops.run(g, id, op)
            spent = if result == :failed and not g.rules.failed_op_costs, do: 0, else: cost
            {:cont, {g, left - spent, events ++ happened}}
        end
      end)

    {game,
     log ++ [opened | events] ++ [%{type: :pack_closed, player: id, spent: budget(game) - left}]}
  end

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
