defmodule GitGame.Beta.ReportTest do
  @moduledoc "M12's done-when: the report's numbers match what this test computes from the same games' logs."
  use GitGame.DataCase, async: true
  alias GitGame.{Beta, Games, Players}
  alias GitGame.Beta.{Mark, Printout, Report}
  alias GitGame.Feedback.Note
  alias GitGame.Games.Record

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

  test "since a date, only the games started on or after it, and the visits, replays and notes since, count" do
    {:ok, ana} = Players.create_anonymous()

    # a game played out while the beta was being built, then one started on launch day
    built = game(ana, 1)
    play_out(built, ana.handle)

    Repo.update_all(from(g in Record, where: g.id == ^built),
      set: [inserted_at: ~U[2026-09-01 12:00:00.000000Z]]
    )

    launched = game(ana, 2)

    for {kind, day} <- [
          {"visit", ~D[2026-09-01]},
          {"visit", ~D[2026-09-02]},
          {"replay", ~D[2026-09-02]}
        ],
        do: Repo.insert!(%Mark{kind: kind, player_id: ana.id, day: day, game_id: built})

    Repo.insert!(%Note{
      player_id: ana.id,
      game_id: built,
      body: "too many conflicts",
      inserted_at: ~U[2026-09-02 09:00:00.000000Z]
    })

    Repo.insert!(%Note{player_id: ana.id, game_id: launched, body: "fun"})

    all = Report.build()
    assert all.games.started == 2 and all.games.finished == 1
    assert all.replays.opened == 1
    assert all.returning == %{came_back_another_day: 1, played_again_after_finishing: 1}
    assert all.feedback == %{notes: 2, players: 1}

    since = Report.build(since: Date.utc_today())
    assert since.games == %{started: 1, finished: 0, finished_by_people: 0, share: 0.0}
    assert since.replays.opened == 0
    assert since.returning == %{came_back_another_day: 0, played_again_after_finishing: 0}
    assert since.feedback == %{notes: 1, players: 1}

    # --feedback prints the notes themselves, each under who left it, indented
    text = Printout.run(["--feedback", "--since", Date.to_iso8601(Date.utc_today())])
    assert text =~ "1 notes from 1 players"

    assert text =~
             ~r/## the notes\n\n\S+ \S+  #{ana.handle}  game #{String.slice(launched, 0, 8)}\n    fun\n/

    refute text =~ "too many conflicts"

    json = JSON.decode!(Printout.run(["--json", "--feedback"]))
    assert Enum.map(json["notes"], & &1["body"]) == ["too many conflicts", "fun"]
  end

  test "the printout is the report as text, or as JSON with --json, from --since a date" do
    text = Printout.run([])
    assert text =~ "# beta report\n"
    assert text =~ "third of the day"

    assert Printout.run(["--since", "2026-10-05"]) =~ "# beta report, since 2026-10-05"

    json = JSON.decode!(Printout.run(["--json", "--since", "2026-10-05"]))
    assert json["since"] == "2026-10-05"
    assert json["games"]["started"] == 0

    assert_raise ArgumentError, fn -> Printout.run(["--since", "next week"]) end
    assert_raise ArgumentError, fn -> Printout.run(["--sinse", "2026-10-05"]) end
  end
end
