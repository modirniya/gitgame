defmodule GitGame.Notifications.PushChannel do
  @moduledoc """
  Reminders by Web Push (ADR-0006, `GitGame.Push`). The push carries nothing: the service worker it wakes fetches the
  player's games and shows the one waiting, so the message's words are the client's, not the push's.
  """
  @behaviour GitGame.Notifications.Channel
  alias GitGame.Push

  @impl true
  def name, do: "push"

  @impl true
  def reaches?(player), do: Push.enabled?() and Push.subscribed?(player)

  @impl true
  def deliver(player, _message), do: Push.wake(player)
end
