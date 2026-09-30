defmodule GitGame.ResolverTest do
  use ExUnit.Case, async: true
  alias GitGame.{Game, Resolver, Rules}

  setup_all do: %{rules: Rules.load!()}

  defp incident(rules, id), do: Enum.find(rules.incidents, &(&1.id == id))

  defp card(id, file, lines, bug \\ false),
    do: %{id: id, kind: :commit, file: file, lines: lines, bug: bug}

  # Day 1 open, on a quiet day, with hands we choose.
  defp day_one(rules, hands, opts \\ []) do
    game =
      Game.new(rules, 7, hands |> Map.keys() |> Enum.sort(), Keyword.get(opts, :length, "live"))

    {game, _} = Resolver.open_day(game)
    game = %{game | incident: incident(rules, Keyword.get(opts, :incident, "quiet_tuesday"))}

    Enum.reduce(hands, game, fn {id, hand}, g ->
      Game.put_player(g, id, %{g.players[id] | hand: hand})
    end)
  end

  defp types(log), do: Enum.map(log, & &1.type)
  # the player's events in the day that closed, not the next day's draw
  defp for_player(log, id),
    do: log |> Enum.take_while(&(&1.type != :day_closed)) |> Enum.filter(&(&1[:player] == id))

  test "opening a day flips an incident from the pile and deals everyone the day's draw", %{
    rules: rules
  } do
    game = Game.new(rules, 7, ["ana", "raj"])
    {game, log} = Resolver.open_day(game)

    assert game.day == 1
    assert game.incident in rules.incidents

    assert [
             %{type: :day_opened, day: 1},
             %{type: :drew, player: "ana", cards: [_, _]},
             %{type: :drew, player: "raj"}
           ] = log

    for id <- game.seats,
        do: assert(length(game.players[id].hand) == rules.starting_hand + rules.draw)
  end

  test "a pack runs op by op until its budget is spent; free ops cost nothing", %{rules: rules} do
    game = day_one(rules, %{"ana" => [card("a1", "auth.js", 4)], "raj" => []})
    pack = [%{op: :add, cards: ["a1"]}, %{op: :commit}, %{op: :pull}, %{op: :push}]

    {game, log} = Resolver.close_day(game, [{"ana", pack}])
    ana = for_player(log, "ana")
    # the pull is free (nobody moved the tip), so all four fit in 3 ops
    assert Enum.map(ana, & &1.type) == [
             :pack_opened,
             :staged,
             :committed,
             :pull_up_to_date,
             :push_accepted,
             :pack_closed
           ]

    assert List.last(ana).spent == 3
    assert Game.commits_on_main(game) == 1
  end

  test "an op that no longer fits is not run, and the pack stops there", %{rules: rules} do
    game =
      day_one(rules, %{"ana" => [card("a1", "auth.js", 4), card("a2", "api.py", 2)], "raj" => []})

    pack = [%{op: :add, cards: ["a1"]}, %{op: :commit}, %{op: :add, cards: ["a2"]}, %{op: :push}]

    {_, log} = Resolver.close_day(game, [{"ana", pack}])

    assert [%{type: :op_skipped, op: :push, message: "not run: it costs 1 and 0 is left"}] =
             Enum.filter(log, &(&1.type == :op_skipped))
  end

  test "a failed op still costs its ops", %{rules: rules} do
    game = day_one(rules, %{"ana" => [], "raj" => []})

    {_, log} =
      Resolver.close_day(game, [
        {"ana", [%{op: :commit}, %{op: :commit}, %{op: :commit}, %{op: :commit}]}
      ])

    ana = for_player(log, "ana")
    assert Enum.count(ana, &(&1.type == :op_failed)) == 3
    assert List.last(ana).spent == 3
  end

  test "the incident sets the budget: Standup Ran Long gives 2 ops", %{rules: rules} do
    game =
      day_one(rules, %{"ana" => [card("a1", "auth.js", 4)], "raj" => []}, incident: "standup")

    {_, log} =
      Resolver.close_day(game, [
        {"ana", [%{op: :add, cards: ["a1"]}, %{op: :commit}, %{op: :push}]}
      ])

    assert %{budget: 2, ops: 3} =
             Enum.find(log, &(&1.type == :pack_opened and &1.player == "ana"))

    assert Enum.any?(log, &(&1.type == :op_skipped))
  end

  test "batched packs resolve in an order from the seed, whatever order they arrived in", %{
    rules: rules
  } do
    game =
      day_one(rules, %{"ana" => [card("a1", "auth.js", 4)], "raj" => [card("r1", "README.md", 2)]})

    ship = fn c -> [%{op: :add, cards: [c]}, %{op: :commit}, %{op: :push}] end

    {g1, l1} = Resolver.close_day(game, [{"ana", ship.("a1")}, {"raj", ship.("r1")}])
    {g2, l2} = Resolver.close_day(game, [{"raj", ship.("r1")}, {"ana", ship.("a1")}])
    assert g1 == g2 and l1 == l2
    # the one resolved second was behind, so exactly one push landed
    assert Enum.count(l1, &(&1.type == :push_accepted)) == 1
  end

  test "in arrival order the first pack to arrive resolves first", %{rules: rules} do
    rules = %{rules | resolution_order: :arrival}

    game =
      day_one(rules, %{"ana" => [card("a1", "auth.js", 4)], "raj" => [card("r1", "README.md", 2)]})

    ship = fn c -> [%{op: :add, cards: [c]}, %{op: :commit}, %{op: :push}] end

    {_, log} = Resolver.close_day(game, [{"raj", ship.("r1")}, {"ana", ship.("a1")}])
    assert %{player: "raj"} = Enum.find(log, &(&1.type == :push_accepted))
  end

  test "someone who sent nothing resolves an empty pack", %{rules: rules} do
    game = day_one(rules, %{"ana" => [], "raj" => []})
    {_, log} = Resolver.close_day(game, [])
    assert Enum.count(log, &(&1.type == :pack_opened and &1.ops == 0)) == 2
  end

  test "the hand limit: declared discards first, then the smallest cards, bugs before clean, commands last",
       %{rules: rules} do
    hand =
      [
        card("keep8", "auth.js", 8),
        card("small_bug", "api.py", 1, true),
        card("small", "README.md", 1),
        %{id: "cmd", kind: :command, command: "blame"}
      ] ++
        for i <- 1..9, do: card("m#{i}", "styles.css", 5)

    game = day_one(rules, %{"ana" => hand, "raj" => []})
    {game, log} = Resolver.close_day(game, [{"ana", %{ops: [], discard: ["keep8"]}}])

    assert %{discarded: gone} = Enum.find(log, &(&1.type == :hand_limit))
    assert Enum.map(gone, & &1.id) == ["keep8", "small_bug", "small"]
    # the next day's draw came after: the hand was at the limit, plus the draw
    assert length(game.players["ana"].hand) == rules.hand_limit + rules.draw
    assert Enum.all?(gone, &(&1 in game.discard))
  end

  test "the day closes into the next: the log ends with the next day opening", %{rules: rules} do
    game = day_one(rules, %{"ana" => [], "raj" => []})
    {game, log} = Resolver.close_day(game, [])
    assert game.day == 2
    assert [:day_closed, :day_opened, :drew, :drew] = log |> types() |> Enum.take(-4)
  end

  test "the final day runs CI when it closes, tagged or not, and no day opens after it", %{
    rules: rules
  } do
    game = day_one(rules, %{"ana" => [], "raj" => []})
    game = %{game | day: game.final_day}
    {game, log} = Resolver.close_day(game, [])
    assert %{by: nil} = game.released
    assert [:ci_ran, :day_closed] = log |> types() |> Enum.take(-2)
  end

  test "a tag ends the game mid-day: packs after it don't run", %{rules: rules} do
    game = day_one(rules, %{"ana" => [], "raj" => []})

    filler =
      for i <- 1..10,
          do: %{
            id: "f#{i}",
            author: "raj",
            cards: [card("fc#{i}", "README.md", 1)],
            flipped: false
          }

    game = %{game | main: game.main ++ filler}

    game =
      Enum.reduce(
        game.seats,
        game,
        &Game.put_player(&2, &1, %{&2.players[&1] | pointer: length(game.main)})
      )

    {game, log} = Resolver.close_day(game, [{"ana", [%{op: :tag}]}, {"raj", [%{op: :tag}]}])
    assert %{by: tagger} = game.released
    assert Enum.count(log, &(&1.type == :tagged)) == 1
    assert Enum.count(log, &(&1.type == :pack_opened)) == 1
    assert tagger in ["ana", "raj"]
  end
end
