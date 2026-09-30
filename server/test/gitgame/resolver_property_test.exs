defmodule GitGame.ResolverPropertyTest do
  @moduledoc """
  The charter's non-negotiable resolver properties (§5, Phase 1), under both resolution orders:

  1. any sequence of packs from any reachable state gives a valid state: every pointer on `main`, every card in
     exactly one place, no pack spending more than its budget, and the game released by its final day;
  2. replaying a game's packs from its seed reproduces it exactly: the same state and the same day log.

  The packs come from a chaos player: random ops, valid and invalid alike (cards it doesn't hold, commits that don't
  exist, ops that don't exist, over-long packs), drawn from its own seeded stream so every run is reproducible.
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
    {packs, rand} = packs(game, rand)
    {next, log} = Resolver.close_day(game, packs)
    check.(next, packs, log)
    if next.released, do: {next, days}, else: loop(next, rand, check, days + 1)
  end

  defp record(game, chaos) do
    {game, _} = Resolver.open_day(game)
    record_loop(game, :rand.seed_s(:exsss, chaos), [])
  end

  defp record_loop(game, rand, days) do
    {packs, rand} = packs(game, rand)
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

  # Everyone sends a pack most days, in a random arrival order; some days someone sends nothing.
  defp packs(game, rand) do
    {seats, rand} = shuffle(game.seats, rand)

    Enum.flat_map_reduce(seats, rand, fn id, r ->
      {roll, r} = :rand.uniform_s(10, r)
      if roll == 1, do: {[], r}, else: pack(game, id, r) |> then(fn {p, r} -> {[{id, p}], r} end)
    end)
  end

  defp pack(game, id, rand) do
    {n, rand} = :rand.uniform_s(6, rand)
    {ops, rand} = Enum.map_reduce(1..n, rand, fn _, r -> op(game, id, r) end)
    {discard, rand} = pick(Enum.map(game.players[id].hand, & &1.id), rand)
    {%{ops: ops, discard: Enum.take(discard, 2)}, rand}
  end

  defp op(game, id, rand) do
    p = game.players[id]
    shas = Enum.map(game.main, & &1.id) ++ ["0000000"]

    {kind, rand} =
      pick_one(
        [
          :add,
          :add,
          :commit,
          :commit,
          :push,
          :push,
          :pull,
          :pull,
          :blame,
          :revert,
          :force,
          :arm,
          :tag,
          :nonsense
        ],
        rand
      )

    {cards, rand} = pick(Enum.map(p.hand, & &1.id) ++ ["k9999"], rand)
    {sha, rand} = pick_one(shas, rand)
    {strategy, rand} = pick_one([nil, :ours, :theirs, :resolve], rand)
    {rebase, rand} = pick_one([false, false, true], rand)

    op =
      case kind do
        :add -> %{op: :add, cards: Enum.take(cards, 2)}
        :commit -> %{op: :commit}
        :push -> %{op: :push}
        :pull -> %{op: :pull, rebase: rebase, strategy: strategy}
        :blame -> %{op: :blame, target: sha}
        :revert -> %{op: :revert, target: sha}
        :force -> %{op: :force}
        :arm -> %{op: :arm, trap: "reflog"}
        :tag -> %{op: :tag}
        :nonsense -> %{op: :cherry_pick}
      end

    {op, rand}
  end

  defp pick_one(list, rand),
    do: :rand.uniform_s(length(list), rand) |> then(fn {i, r} -> {Enum.at(list, i - 1), r} end)

  defp pick(list, rand),
    do: shuffle(list, rand) |> then(fn {l, r} -> {Enum.take(l, max(1, div(length(l), 3))), r} end)

  defp shuffle(list, rand) do
    {keyed, rand} =
      Enum.map_reduce(list, rand, fn x, r ->
        :rand.uniform_s(r) |> then(fn {k, r} -> {{k, x}, r} end)
      end)

    {keyed |> Enum.sort() |> Enum.map(&elem(&1, 1)), rand}
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
