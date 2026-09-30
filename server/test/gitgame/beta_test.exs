defmodule GitGame.BetaTest do
  use GitGame.DataCase, async: true
  alias GitGame.{Beta, Players}
  alias GitGame.Beta.Mark

  test "a visit is marked once a day, and says where it came from only if that's a known source" do
    {:ok, ana} = Players.create_anonymous()
    {:ok, raj} = Players.create_anonymous()

    :ok = Beta.visit(ana)
    :ok = Beta.visit(ana, "notification")
    :ok = Beta.visit(raj, "a link my friend made up")

    assert [%{player_id: a, via: nil}] = Repo.all(from m in Mark, where: m.player_id == ^ana.id)
    assert a == ana.id
    assert [%{via: nil}] = Repo.all(from m in Mark, where: m.player_id == ^raj.id)
  end

  test "a replay is marked once a day per player and game, and for someone signed out too" do
    {:ok, ana} = Players.create_anonymous()
    {:ok, %{id: game}} = GitGame.Games.create(["hal", "eve"], bots: ["hal", "eve"], seed: 7)

    for _ <- 1..3, do: Beta.replay(ana, game)
    Beta.replay(nil, game)

    assert Repo.aggregate(from(m in Mark, where: m.kind == "replay"), :count) == 2
  end
end
