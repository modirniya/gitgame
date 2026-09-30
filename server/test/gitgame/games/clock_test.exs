defmodule GitGame.Games.ClockTest do
  @moduledoc "Days on a clock (M5). The tests are the clock: draining the queue runs the next deadline, whatever the time."
  use GitGame.DataCase, async: true
  use Oban.Testing, repo: GitGame.Repo
  alias GitGame.Games
  alias GitGame.Games.CloseDay

  defp new_game(length \\ "live"), do: Games.create(["ana", "raj"], seed: 42, day_length: length)

  test "a new game's first day closes one day length after it opened" do
    {:ok, %{id: id}} = new_game()
    {:ok, %{deadline: deadline}} = Games.load(id)

    assert_enqueued(worker: CloseDay, args: %{game_id: id, day: 1}, scheduled_at: deadline)

    assert DateTime.diff(
             deadline,
             Repo.one!(from e in Games.Event, where: e.game_id == ^id).inserted_at
           ) == 60
  end

  test "at the deadline the day closes, and the next day's deadline is scheduled" do
    {:ok, %{id: id}} = new_game("correspondence")
    assert :ok = perform_job(CloseDay, %{game_id: id, day: 1})

    {:ok, %{game: game, deadline: deadline}} = Games.load(id)
    assert game.day == 2
    assert_enqueued(worker: CloseDay, args: %{game_id: id, day: 2}, scheduled_at: deadline)
    assert DateTime.diff(deadline, DateTime.utc_now()) in 86_390..86_400
  end

  test "the day closes early when every pack is in; its deadline job then does nothing" do
    {:ok, %{id: id}} = new_game()
    {:ok, %{closed: false}} = Games.send_pack(id, "ana", 1, %{"ops" => []})
    {:ok, %{closed: true}} = Games.send_pack(id, "raj", 1, %{"ops" => []})

    assert :ok = perform_job(CloseDay, %{game_id: id, day: 1})
    {:ok, %{game: game}} = Games.load(id)
    assert game.day == 2
  end

  test "a job for a game that doesn't exist is cancelled, not retried" do
    assert {:cancel, _} = perform_job(CloseDay, %{game_id: Ecto.UUID.generate(), day: 1})
  end

  for {length, days} <- [{"live", 12}, {"correspondence", 7}] do
    @length length
    @days days

    test "a #{length} game runs to its release unattended, with one player gone absent" do
      {:ok, %{id: id}} = new_game(@length)
      played = play_out(id, 0)

      {:ok, %{game: game}} = Games.load(id)
      assert game.released, "the game should be released"
      assert game.players["raj"].left, "raj sent nothing, so he left the company"
      assert played <= @days
      assert game.released.by == nil or is_binary(game.released.by)
    end
  end

  # ana sends a pack every day, raj never does; the queue is drained once a day, running whatever deadline is due.
  defp play_out(id, played) do
    {:ok, %{game: game, version: version}} = Games.load(id)

    if game.released do
      played
    else
      {:ok, _} =
        Games.send_pack(id, "ana", version, %{"ops" => [%{"op" => "pull"}, %{"op" => "push"}]})

      Oban.drain_queue(queue: :days, with_scheduled: true)
      play_out(id, played + 1)
    end
  end
end
