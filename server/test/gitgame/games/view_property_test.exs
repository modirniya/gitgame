defmodule GitGame.Games.ViewPropertyTest do
  @moduledoc """
  M6's property: no view ever contains another player's private data. After every day of generated games (played by
  `GitGame.Chaos`), each player's view and the public view are encoded to JSON exactly as the API sends them, and none
  may name a card in another player's hand, staging area or local branch, or say whether a face-down commit of
  someone else's is a bug.
  """
  use ExUnit.Case, async: true
  use ExUnitProperties
  alias GitGame.{Game, Resolver, Rules}
  alias GitGame.Games.View

  @rules Rules.load!()

  property "a view shows its reader nothing another player keeps hidden" do
    check all(
            seed <- integer(1..1_000_000_000),
            players <- integer(2..5),
            chaos <- integer(),
            max_runs: 300
          ) do
      game = Game.new(@rules, seed, Enum.map(1..players, &"p#{&1}"))
      {game, opened} = Resolver.open_day(game)

      play(
        %{game: game, version: 1, days: [], opened: opened, sent: []},
        :rand.seed_s(:exsss, chaos)
      )
    end
  end

  defp play(state, rand) do
    check_views(state)

    unless state.game.released do
      {packs, rand} = GitGame.Chaos.packs(state.game, rand)
      {game, log} = Resolver.close_day(state.game, packs)
      {closed, opened} = Enum.split_while(log, &(&1.type != :day_opened))

      play(
        %{
          state
          | game: game,
            days: state.days ++ [%{day: state.game.day, log: closed}],
            opened: opened
        },
        rand
      )
    end
  end

  defp check_views(%{game: game} = state) do
    public = JSON.encode!(View.public(state, "g"))
    for id <- game.seats, do: refute_secrets(public, game, id, "the public view")

    # traps: nobody's show in the public view; in a reader's view, exactly the reader's own
    refute public =~ ~s("armed")

    for reader <- game.seats do
      view = JSON.encode!(View.for_player(state, "g", reader))

      for other <- game.seats,
          other != reader,
          do: refute_secrets(view, game, other, "#{reader}'s view")

      assert JSON.decode!(view)["you"]["armed"] == game.players[reader].armed
    end

    # a face-down commit never says whether it is a bug, whoever reads
    for c <- JSON.decode!(public)["main"],
        c["flipped"] == false,
        do: refute(Map.has_key?(c, "bug"))
  end

  defp refute_secrets(json, game, owner, where) do
    p = game.players[owner]
    secret = Enum.map(p.hand ++ p.staged ++ Enum.flat_map(p.local, & &1.cards), & &1.id)

    for id <- secret do
      refute json =~ ~s("#{id}"), "#{where} names #{owner}'s private card #{id}"
    end
  end
end
