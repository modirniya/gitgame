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
  end
end
