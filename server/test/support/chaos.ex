defmodule GitGame.Chaos do
  @moduledoc """
  A chaos player for property tests: every player sends a pack most days, in a random arrival order, of random ops,
  valid and invalid alike (cards it doesn't hold, commits that don't exist, ops that don't exist, over-long packs,
  discard declarations). It draws from its own seeded stream, so every run is reproducible.
  """

  # Everyone sends a pack most days, in a random arrival order; some days someone sends nothing.
  def packs(game, rand) do
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
end
