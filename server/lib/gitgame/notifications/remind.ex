defmodule GitGame.Notifications.Remind do
  @moduledoc "The job behind each notification moment (ADR-0006): a day's reminder, or a game's release."
  use Oban.Worker, queue: :notifications, max_attempts: 5

  @impl Oban.Worker
  def perform(%Oban.Job{args: %{"game_id" => game_id, "day" => day, "kind" => kind}}),
    do: GitGame.Notifications.send_now(game_id, day, kind)
end
