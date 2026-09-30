defmodule GitGame.ResolverPropertyTest do
  @moduledoc """
  The charter's non-negotiable resolver properties (§5, Phase 1), under both resolution orders:

  1. any sequence of packs from any reachable state gives a valid state: every pointer on `main`, every card in
     exactly one place, no pack spending more than its budget, and the game released by its final day;
  2. replaying a game's packs from its seed reproduces it exactly: the same state and the same day log.

  The packs come from `GitGame.Chaos` (test/support): random ops, valid and invalid alike.
  """
  use ExUnit.Case, async: true
  use ExUnitProperties
  alias GitGame.{Game, Resolver, Rules}

  @rules Rules.load!()
  @runs 1500

  for order <- [:batch_at_close, :arrival] do
    @order order

    property "every day leaves a valid state (#{order})" do
      check all(game <- game(@order), chaos <- integer(), max_runs: @runs) do
        {final, days} = play(game, chaos, fn g, packs, log -> assert_valid(g, packs, log) end)
        assert final.released, "the game must be released by its final day"
        assert days <= final.final_day
      end
    end

    property "replaying the packs from the seed reproduces the game (#{order})" do
      check all(game <- game(@order), chaos <- integer(), max_runs: @runs) do
        {first, recorded} = record(game, chaos)
        {again, replayed} = replay(game, recorded)
        assert again == first
        assert replayed == Enum.map(recorded, &elem(&1, 1))
      end
    end
  end

  # ---------- games and packs ----------

  defp game(order) do
    gen all(
          seed <- integer(1..1_000_000_000),
          players <- integer(2..5),
          length <- member_of(["live", "correspondence"])
        ) do
      rules = %{@rules | resolution_order: order}
      Game.new(rules, seed, Enum.map(1..players, &"p#{&1}"), length)
    end
  end

  # Plays a whole game with the chaos player, calling `check` after every day. Returns the final game and days played.
  defp play(game, chaos, check) do
    {game, _} = Resolver.open_day(game)
    loop(game, :rand.seed_s(:exsss, chaos), check, 1)
  end

  defp loop(game, rand, check, days) do
    {packs, rand} = GitGame.Chaos.packs(game, rand)
    {next, log} = Resolver.close_day(game, packs)
    check.(next, packs, log)
    if next.released, do: {next, days}, else: loop(next, rand, check, days + 1)
  end

  defp record(game, chaos) do
    {game, _} = Resolver.open_day(game)
    record_loop(game, :rand.seed_s(:exsss, chaos), [])
  end

  defp record_loop(game, rand, days) do
    {packs, rand} = GitGame.Chaos.packs(game, rand)
    {next, log} = Resolver.close_day(game, packs)
    days = days ++ [{packs, log}]
    if next.released, do: {next, days}, else: record_loop(next, rand, days)
  end

  defp replay(game, recorded) do
    {game, _} = Resolver.open_day(game)

    Enum.reduce(recorded, {game, []}, fn {packs, _}, {g, logs} ->
      Resolver.close_day(g, packs) |> then(fn {g, log} -> {g, logs ++ [log]} end)
    end)
  end

  # ---------- what "valid" means ----------

  defp assert_valid(game, _packs, log) do
    for id <- game.seats do
      pointer = game.players[id].pointer

      assert pointer >= 1 and pointer <= length(game.main),
             "#{id}'s pointer #{pointer} is off main (#{length(game.main)})"
    end

    # every card of the online deck is in exactly one place
    in_play =
      game.draw_pile ++
        game.discard ++
        Enum.flat_map(game.seats, fn id ->
          p = game.players[id]
          p.hand ++ p.staged ++ Enum.flat_map(p.local, & &1.cards)
        end) ++ Enum.flat_map(game.main, & &1.cards)

    ids = Enum.map(in_play, & &1.id)
    deck = Enum.map(Game.online_deck(game.rules), & &1.id)
    lost = deck -- ids
    doubled = ids -- deck

    assert lost == [] and doubled == [],
           "cards lost: #{inspect(lost)}, duplicated: #{inspect(doubled)} after #{inspect(Enum.map(log, & &1.type))}"

    # every commit exists once, on main or on one local branch
    shas =
      Enum.map(game.main, & &1.id) ++
        Enum.flat_map(game.seats, &Enum.map(game.players[&1].local, fn c -> c.id end))

    assert shas == Enum.uniq(shas), "a commit is in two places"

    # no pack spent more than its budget
    for %{type: :pack_opened, player: id, budget: budget} <- log do
      %{spent: spent} = Enum.find(log, &(&1.type == :pack_closed and &1.player == id))
      assert spent <= budget, "#{id} spent #{spent} of #{budget}"
    end

    # nobody ends a day over the hand limit (the next day's draw comes after the limit)
    for id <- game.seats, !game.released do
      assert length(game.players[id].hand) <= game.rules.hand_limit + game.rules.draw
    end
  end
end
