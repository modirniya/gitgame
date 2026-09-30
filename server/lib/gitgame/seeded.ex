defmodule GitGame.Seeded do
  @moduledoc """
  Every random thing in a game, from one seed. Each purpose (the deck's shuffle, a day's incident, a day's resolution
  order, a day's die roll) draws from its own stream, derived from the seed and the purpose alone, so replaying a game
  needs nothing but its seed and its packs, and drawing one day's incident can never shift another day's order.

  `:erlang.phash2/1` is documented to hash a term the same way on every architecture and runtime version, and
  `:exsss` is a fixed algorithm, so a seed means the same game on any server that ever runs it.
  """

  @doc "A random stream for `purpose` in the game seeded with `seed`."
  def stream(seed, purpose),
    do: :rand.seed_s(:exsss, :erlang.phash2({seed, purpose}, 4_294_967_296))

  @doc "`list` in a random order, and the stream after it."
  def shuffle(list, state) do
    {keyed, state} =
      Enum.map_reduce(list, state, fn x, s ->
        {k, s} = :rand.uniform_s(s)
        {{k, x}, s}
      end)

    {keyed |> Enum.sort_by(&elem(&1, 0)) |> Enum.map(&elem(&1, 1)), state}
  end

  @doc "One element of `list`, chosen by the stream for `purpose`."
  def pick(list, seed, purpose) do
    {i, _} = :rand.uniform_s(length(list), stream(seed, purpose))
    Enum.at(list, i - 1)
  end

  @doc "A whole number from 1 to `n`, from the stream for `purpose`."
  def roll(n, seed, purpose), do: n |> :rand.uniform_s(stream(seed, purpose)) |> elem(0)

  @doc "A short commit hash, as Git prints it: 7 hex digits derived from the seed and a counter."
  def sha(seed, n),
    do:
      :crypto.hash(:sha, :erlang.term_to_binary({seed, n}))
      |> Base.encode16(case: :lower)
      |> binary_part(0, 7)
end
