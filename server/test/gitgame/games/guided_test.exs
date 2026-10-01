defmodule GitGame.Games.GuidedTest do
  use ExUnit.Case, async: true
  alias GitGame.{Game, Resolver, Rules}
  alias GitGame.Games.Guided

  setup_all do: %{rules: Rules.load!()}

  @seats ["ana", "bot"]

  # The pack the guide has you write, with the first commit card in your hand that is `clean` (or any, if not asked).
  defp ship(game, id, clean) do
    card = Enum.find(game.players[id].hand, &(&1.kind == :commit and not (clean and &1.bug)))
    [%{op: :add, cards: [card.id]}, %{op: :commit}, %{op: :pull}, %{op: :push}]
  end

  test "every seed it chooses deals a full day 1, a clean card in hand, your pack first, and a push that lands",
       %{rules: rules} do
    for start <- 1_000..300_000//1_000 do
      seed = Guided.seed(rules, @seats, "lunch", ["bot"], start)
      {game, _} = rules |> Game.new(seed, @seats, "lunch") |> Resolver.open_day()

      assert Resolver.budget(game) == rules.ops_budget
      assert Enum.any?(game.players["ana"].hand, &(&1.kind == :commit and not &1.bug))
      assert Resolver.order(game, ["bot"]) == @seats

      # the bot plays the same pack: had it gone first, its push would have moved the tip and squeezed out yours
      {_, log} =
        Resolver.close_day(game, [
          {"bot", ship(game, "bot", false)},
          {"ana", ship(game, "ana", true)}
        ])

      assert Enum.any?(log, &match?(%{type: :push_accepted, player: "ana"}, &1)), "seed #{seed}"
    end
  end

  test "when no seed fits, it stops after a thousand and deals the last one tried", %{
    rules: rules
  } do
    # packs resolving as they arrive, the bot's would always be in before yours
    rules = %{rules | resolution_order: :arrival}
    assert Guided.seed(rules, @seats, "lunch", ["bot"], 5_000) == 4_001
  end
end
