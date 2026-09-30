defmodule GitGame.Games.CloseDay do
  @moduledoc """
  The job that closes a day at its deadline. Each day that opens gets one, enqueued in the same transaction as the
  event that opened it, so a day can never open without its deadline. Closing a day that has already closed (early,
  because every pack was in, or by a retried job) does nothing, so the job can safely run late, twice, or after the
  game is over.
  """
  use Oban.Worker, queue: :days, max_attempts: 20

  @impl Oban.Worker
  def perform(%Oban.Job{args: %{"game_id" => id, "day" => day}}) do
    case GitGame.Games.close_day(id, day) do
      {:ok, _} -> :ok
      {:error, :over, _} -> :ok
      {:error, :not_found, _} -> {:cancel, "no game #{id}"}
    end
  end
end
