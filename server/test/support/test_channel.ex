defmodule GitGame.TestChannel do
  @moduledoc """
  A notification channel for tests: it reaches every player, and "delivers" by sending the message to the test
  process, so a test can `assert_received {:notified, player_id, message}`. Oban's manual testing runs jobs in the
  test's own process, which is what makes this work.
  """
  @behaviour GitGame.Notifications.Channel

  @impl true
  def name, do: "test"

  @impl true
  def reaches?(_player), do: true

  @impl true
  def deliver(player, message) do
    send(self(), {:notified, player.id, message})
    :ok
  end
end
