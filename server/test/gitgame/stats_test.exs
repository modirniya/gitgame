defmodule GitGame.StatsTest do
  use GitGame.DataCase, async: true
  alias GitGame.{Games, Players, Stats}
  alias GitGame.Beta.Mark

  defp game(player, seed) do
    {:ok, %{id: id}} =
      Games.create([player.handle, "bot"],
        bots: ["bot"],
        seed: seed,
        holders: %{player.handle => player.id}
      )

    id
  end

  test "counts today's players, games, people's packs and visits, and the games still being played" do
    {:ok, ana} = Players.create_anonymous()
    {:ok, raj} = Players.create_anonymous()

    playing = game(ana, 1)
    {:ok, %{version: v}} = Games.load(playing)
    {:ok, _} = Games.send_pack(playing, ana.handle, v, %{"ops" => [%{"op" => "pull"}]})

    # raj sends nothing, leaves the company, and the bot plays his game to its release: a game over, with jobs left
    # from the days it closed early
    over = game(raj, 2)
    for _ <- 1..3, do: Games.close_day(over)
    assert {:ok, %{game: %{released: released}}} = Games.load(over)
    assert released != nil

    Repo.insert!(%Mark{kind: "visit", player_id: ana.id, day: Date.utc_today()})

    s = Stats.build()
    today = List.last(s.days)

    assert length(s.days) == 365
    assert today.date == Date.utc_today()
    # one pack from ana; the bot's many, in both games, aren't counted
    assert Map.take(today, [:players, :games, :packs, :visits]) == %{
             players: 2,
             games: 2,
             packs: 1,
             visits: 1
           }

    assert hd(s.days) |> Map.take([:players, :games, :packs, :visits]) == %{
             players: 0,
             games: 0,
             packs: 0,
             visits: 0
           }

    assert s.totals == %{players: 2, games: 2, packs: 1}

    assert s.pulse.in_progress == 1
    assert s.pulse.last_pack != nil and s.pulse.last_game != nil
    assert %{since: nil, left_out: 0} = s
  end

  test "counts from a fresh start, and leaves the team's test players out" do
    {:ok, old} = Players.create_anonymous()
    before = game(old, 3)
    since = DateTime.utc_now()

    {:ok, ana} = Players.create_anonymous()
    {:ok, tester} = Players.create_anonymous()
    playing = game(ana, 1)
    testing = game(tester, 4)

    for {id, seat} <- [{playing, ana.handle}, {testing, tester.handle}, {before, old.handle}] do
      {:ok, %{version: v}} = Games.load(id)
      {:ok, _} = Games.send_pack(id, seat, v, %{"ops" => [%{"op" => "pull"}]})
    end

    for p <- [ana, tester, old],
        do: Repo.insert!(%Mark{kind: "visit", player_id: p.id, day: Date.utc_today()})

    s = Stats.build(Date.utc_today(), since: since, team: [tester.handle, "nobody-00"])
    today = List.last(s.days)

    # the old player and their game came before the start, and the tester is the team's; but what the old player did
    # after the start counts, as a player coming back does
    assert Map.take(today, [:players, :games, :packs, :visits]) == %{
             players: 1,
             games: 1,
             packs: 2,
             visits: 2
           }

    assert s.totals == %{players: 1, games: 1, packs: 2}
    assert s.pulse.in_progress == 1
    assert %{since: ^since, left_out: 1} = s
  end
end
