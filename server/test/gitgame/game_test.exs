defmodule GitGame.GameTest do
  use ExUnit.Case, async: true
  alias GitGame.{Game, Rules}

  setup_all do: %{rules: Rules.load!()}

  test "the online deck is every commit card and the switched-on command cards", %{rules: rules} do
    deck = Game.online_deck(rules)
    assert Enum.count(deck, &(&1.kind == :commit)) == 60

    assert deck |> Enum.filter(&(&1.kind == :command)) |> Enum.frequencies_by(& &1.command) == %{
             "blame" => 5,
             "force" => 5,
             "reflog" => 4,
             "revert" => 4
           }

    assert deck |> Enum.map(& &1.id) |> Enum.uniq() |> length() == length(deck)
  end

  test "a new game deals the starting hand to each seat and keeps the rest face down", %{
    rules: rules
  } do
    game = Game.new(rules, 42, ["ana", "raj", "kim"])

    for id <- game.seats, do: assert(length(game.players[id].hand) == rules.starting_hand)
    in_hands = Enum.flat_map(game.seats, &game.players[&1].hand)
    assert length(in_hands) + length(game.draw_pile) == length(Game.online_deck(rules))
    assert MapSet.disjoint?(MapSet.new(in_hands, & &1.id), MapSet.new(game.draw_pile, & &1.id))
  end

  test "main starts with the initial commit, and every pointer on it", %{rules: rules} do
    game = Game.new(rules, 42, ["ana", "raj"])
    assert [%{initial: true, id: sha}] = game.main
    assert sha =~ ~r/^[0-9a-f]{7}$/
    assert Game.commits_on_main(game) == 0
    for id <- game.seats, do: assert(Game.behind_by(game, id) == 0)
  end

  test "the same seed deals the same game; another seed deals another", %{rules: rules} do
    assert Game.new(rules, 42, ["ana", "raj"]) == Game.new(rules, 42, ["ana", "raj"])

    refute Game.new(rules, 42, ["ana", "raj"]).draw_pile ==
             Game.new(rules, 43, ["ana", "raj"]).draw_pile
  end

  test "a game has 2 to 5 different players", %{rules: rules} do
    assert_raise ArgumentError, ~r/2 to 5 different players/, fn ->
      Game.new(rules, 1, ["ana"])
    end

    assert_raise ArgumentError, ~r/2 to 5 different players/, fn ->
      Game.new(rules, 1, ~w(a b c d e f))
    end

    assert_raise ArgumentError, ~r/2 to 5 different players/, fn ->
      Game.new(rules, 1, ["ana", "ana"])
    end
  end
end
