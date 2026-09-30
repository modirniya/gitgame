defmodule GitGame.SeededTest do
  use ExUnit.Case, async: true
  alias GitGame.Seeded

  test "a seed and a purpose always give the same draws" do
    assert Seeded.pick(Enum.to_list(1..100), 42, {:incident, 3}) ==
             Seeded.pick(Enum.to_list(1..100), 42, {:incident, 3})

    assert Seeded.roll(6, 42, {:flaky, 2}) == Seeded.roll(6, 42, {:flaky, 2})
  end

  test "purposes are independent streams: another day or another seed draws differently" do
    draws = for day <- 1..20, do: Seeded.roll(1_000_000, 42, {:incident, day})
    assert length(Enum.uniq(draws)) == 20
    refute Seeded.roll(1_000_000, 42, :deck) == Seeded.roll(1_000_000, 43, :deck)
  end

  test "shuffle is a permutation" do
    {shuffled, _} = Seeded.shuffle(Enum.to_list(1..78), Seeded.stream(7, :deck))
    assert Enum.sort(shuffled) == Enum.to_list(1..78)
    refute shuffled == Enum.to_list(1..78)
  end

  test "a commit hash looks like Git's short hash" do
    assert Seeded.sha(42, 1) =~ ~r/^[0-9a-f]{7}$/
    refute Seeded.sha(42, 1) == Seeded.sha(42, 2)
  end
end
