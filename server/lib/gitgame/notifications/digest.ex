defmodule GitGame.Notifications.Digest do
  @moduledoc """
  The daily digest (ADR-0006): once a day, for each player who chose it and confirmed their address, one email listing
  the games that wait on their pack, if any do. Run by Oban's cron (`config/config.exs`).
  """
  use Oban.Worker, queue: :notifications, max_attempts: 3
  import Ecto.Query
  alias GitGame.{Email, Games, Repo}
  alias GitGame.Email.Address

  @impl Oban.Worker
  def perform(_job) do
    if Email.enabled?() do
      for a <-
            Repo.all(
              from a in Address, where: a.digest and not is_nil(a.confirmed_at), preload: :player
            ) do
        waiting = Games.list_for(a.player_id) |> Enum.filter(&(&1.waiting_on_you != []))
        if waiting != [], do: Email.digest(a.player, waiting)
      end
    end

    :ok
  end
end
