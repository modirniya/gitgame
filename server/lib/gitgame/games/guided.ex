defmodule GitGame.Games.Guided do
  @moduledoc """
  The seed of a guided first game (phase-1-plan M15h). The guide has a new player add a clean card, commit and push on
  day 1, and that first push should land, as it did in the prototype. Not every seed deals that: a bot whose pack
  resolves first moves the tip, so the pull costs an op and the push no longer fits the budget (and the pull merges, for
  a merge token); Standup Ran Long leaves no op for the push either; Flaky CI may bounce it. Each is the wrong first
  lesson.

  The rules are the same as in any game; only which shuffle is dealt is chosen. Seeds are tried in turn, each asked of
  the game's own functions (`GitGame.Game.new/4`, `GitGame.Resolver`), until one deals a full day 1, a clean card in
  the person's hand, their pack resolving before every bot's, and their first push landing.
  """
  alias GitGame.{Game, Resolver}

  # About one seed in three fits, so a search takes a few tries and a thousand all failing never happens in practice;
  # the cap is there so that creating a game can't hang on it all the same.
  @candidates 1_000

  @doc """
  The first seed counting down from `start` (a seed drawn at random) whose game, for `seats` of which `bots` are bots,
  opens as a guided game needs; after `@candidates` of them, the last one tried, fitting or not.
  """
  def seed(rules, seats, length, bots, start) do
    # down, not up: a seed drawn near the largest one JSON carries exactly never passes it
    last = start - @candidates + 1
    Enum.find(start..last//-1, last, &fits?(rules, seats, length, bots, &1))
  end

  defp fits?(rules, seats, length, bots, seed) do
    {game, _opened} = rules |> Game.new(seed, seats, length) |> Resolver.open_day()
    [you | _] = seats -- bots
    card = Enum.find(game.players[you].hand, &match?(%{kind: :commit, bug: false}, &1))

    Resolver.budget(game) == rules.ops_budget and card != nil and first?(game, you, bots) and
      lands?(game, you, card)
  end

  # A bot sends its pack the moment the day opens, so it has always arrived before the person's.
  defp first?(game, you, bots),
    do: game |> Resolver.order(bots) |> Enum.find(&(&1 == you or &1 in bots)) == you

  # The pack the guide has them write, resolved alone: nothing resolves before it, so what it does alone it does in
  # the game, whatever the bot sends.
  defp lands?(game, you, card) do
    pack = [%{op: :add, cards: [card.id]}, %{op: :commit}, %{op: :pull}, %{op: :push}]
    {_game, log} = Resolver.close_day(game, [{you, pack}])
    Enum.any?(log, &match?(%{type: :push_accepted, player: ^you}, &1))
  end
end
