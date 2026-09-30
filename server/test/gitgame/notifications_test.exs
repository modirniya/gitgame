defmodule GitGame.NotificationsTest do
  @moduledoc "ADR-0006's reminders, through GitGame.TestChannel, which reaches every player by messaging this test."
  use GitGame.DataCase, async: true
  use Oban.Testing, repo: GitGame.Repo
  alias GitGame.{Games, Players}
  alias GitGame.Notifications.Remind

  defp game(length, holders, opts \\ []) do
    seats = Map.keys(holders) ++ Keyword.get(opts, :bots, ["bot"])
    ids = Map.new(holders, fn {seat, p} -> {seat, p.id} end)

    {:ok, %{id: id}} =
      Games.create(Enum.sort(seats),
        day_length: length,
        bots: Keyword.get(opts, :bots, ["bot"]),
        holders: ids,
        seed: 5
      )

    id
  end

  test "a 24-hour day's opening schedules a reminder now and one with a quarter of the day left" do
    {:ok, ana} = Players.create_anonymous()
    id = game("correspondence", %{"ana" => ana})

    {:ok, %{deadline: deadline}} = Games.load(id)
    assert [now, late] = all_enqueued(worker: Remind) |> Enum.sort_by(& &1.scheduled_at, DateTime)
    assert now.args == %{"game_id" => id, "day" => 1, "kind" => "pack_due"}
    assert DateTime.diff(deadline, late.scheduled_at) == div(86_400, 4)
  end

  test "a shorter day has no reminders: it would close before one was read" do
    {:ok, ana} = Players.create_anonymous()
    game("live", %{"ana" => ana})
    game("lunch", %{"ana" => ana})
    refute_enqueued(worker: Remind)
  end

  test "whoever's pack isn't in hears once, on each channel; whoever's is doesn't" do
    {:ok, ana} = Players.create_anonymous()
    {:ok, raj} = Players.create_anonymous()
    id = game("correspondence", %{"ana" => ana, "raj" => raj}, bots: [])
    {:ok, _} = Games.send_pack(id, "raj", 1, %{"ops" => []})

    args = %{game_id: id, day: 1, kind: "pack_due"}
    assert :ok = perform_job(Remind, args)
    assert_received {:notified, a, %{kind: "pack_due", title: "your pack is due", path: path}}
    assert a == ana.id
    assert path == "/#/g/#{id}"
    refute_received {:notified, _, _}

    # the quarter-left job, or the same job run twice: at most once a game a day on each channel
    assert :ok = perform_job(Remind, args)
    refute_received {:notified, _, _}
  end

  test "a hotseat player hears once per game, however many of their seats owe a pack" do
    {:ok, ana} = Players.create_anonymous()
    id = game("correspondence", %{"ana" => ana, "raj" => ana})

    perform_job(Remind, %{game_id: id, day: 1, kind: "pack_due"})
    assert_received {:notified, _, _}
    refute_received {:notified, _, _}
  end

  test "a reminder for a day that has closed reminds no one" do
    {:ok, ana} = Players.create_anonymous()
    id = game("correspondence", %{"ana" => ana})
    {:ok, _} = Games.close_day(id, 1)

    perform_job(Remind, %{game_id: id, day: 1, kind: "pack_due"})
    refute_received {:notified, _, _}
  end

  test "the release is news for everyone in the game, once" do
    {:ok, ana} = Players.create_anonymous()
    id = game("correspondence", %{"ana" => ana})
    for _ <- 1..7, do: Games.close_day(id)

    {:ok, %{game: %{released: %{day: day}}}} = Games.load(id)
    assert_enqueued(worker: Remind, args: %{game_id: id, day: day, kind: "released"})

    perform_job(Remind, %{game_id: id, day: day, kind: "released"})
    assert_received {:notified, _, %{kind: "released", title: "v1.0 has shipped"}}
  end
end
