defmodule GitGame.Beta.ReportTest do
  @moduledoc "M12's done-when: the report's numbers match what this test computes from the same games' logs."
  use GitGame.DataCase, async: true
  alias GitGame.{Beta, Games, Players}
  alias GitGame.Beta.{Mark, Report}

  defp game(player, seed) do
    {:ok, %{id: id}} =
      Games.create([player.handle, "bot"],
        bots: ["bot"],
        seed: seed,
        holders: %{player.handle => player.id}
      )

    id
  end

  # the player ships their biggest card with a pull before the push, every day, until the release
  defp play_out(id, seat) do
    {:ok, %{game: g, version: v}} = Games.load(id)

    unless g.released do
      card =
        g.players[seat].hand
        |> Enum.filter(&(&1.kind == :commit))
        |> Enum.max_by(& &1.lines, fn -> nil end)

      build = if card, do: [%{"op" => "add", "cards" => [card.id]}, %{"op" => "commit"}], else: []
      ops = [%{"op" => "pull"}, %{"op" => "push"} | build]
      {:ok, _} = Games.send_pack(id, seat, v, %{"ops" => ops})
      play_out(id, seat)
    end
  end

  # a seat's events, across every closed day of a game's log
  defp events(id, seat) do
    {:ok, s} = Games.load(id)
    for %{log: log} <- s.days, e <- log, e[:player] == seat, do: e
  end

  test "the report counts what the logs and marks hold, for people's seats only" do
    {:ok, ana} = Players.create_anonymous()
    {:ok, raj} = Players.create_anonymous()

    finished = game(ana, 1)
    play_out(finished, ana.handle)

    # raj never sends a pack: two empty days, and he has left the company, and the bot plays the game out alone
    absent = game(raj, 2)
    for _ <- 1..3, do: Games.close_day(absent)

    # ana plays again after finishing, and replays her finished game
    _again = game(ana, 3)
    Beta.replay(ana, finished)

    # raj came back on two days by himself; ana once by herself, and once from a notification
    for {player, day, via} <- [
          {raj, ~D[2026-09-28], nil},
          {raj, ~D[2026-09-29], nil},
          {ana, ~D[2026-09-28], nil},
          {ana, ~D[2026-09-29], "notification"}
        ],
        do: Repo.insert!(%Mark{kind: "visit", player_id: player.id, day: day, via: via})

    r = Report.build()
    ana_events = events(finished, ana.handle)
    raj_events = events(absent, raj.handle)
    {:ok, %{days: ana_days}} = Games.load(finished)

    assert r.games == %{started: 3, finished: 2, finished_by_people: 1, share: 0.333}

    # one pack a day from ana, and none from raj: the bots' packs aren't counted
    packs = r.send_timing |> Map.values() |> Enum.map(& &1.packs) |> Enum.sum()
    assert packs == length(ana_days)

    pushed = r.send_timing |> Map.values() |> Enum.map(& &1.pushed) |> Enum.sum()
    assert pushed == Enum.count(ana_events, &(&1.type == :push_accepted))

    assert r.failed_pushes.total ==
             Enum.count(ana_events, &(&1.type == :op_failed and &1.op == :push))

    assert r.absences == %{
             empty_packs: Enum.count(raj_events, &(&1.type == :empty_pack)),
             left_the_company: 1,
             games_someone_left: 1
           }

    assert r.replays == %{opened: 1, players: 1, finished_games_replayed: 1}
    assert r.returning == %{came_back_another_day: 1, played_again_after_finishing: 1}
  end

  test "the task prints the report, and --json gives the same numbers" do
    report = Report.build()
    text = Mix.Tasks.Gitgame.BetaReport.format(report)
    assert text =~ "# beta report"
    assert text =~ "third of the day"
    assert JSON.decode!(JSON.encode!(report))["games"]["started"] == report.games.started
  end
end
