defmodule GitGame.Notifications.EmailChannel do
  @moduledoc "Reminders by email (ADR-0006, `GitGame.Email`), to a confirmed address, for players who didn't choose the digest."
  @behaviour GitGame.Notifications.Channel

  @impl true
  def name, do: "email"

  @impl true
  def reaches?(player), do: GitGame.Email.reaches?(player)

  @impl true
  def deliver(player, message), do: GitGame.Email.remind(player, message)
end
