defmodule GitGame.Games.Signal do
  @moduledoc """
  "Something changed: fetch again" (charter decision 9: push channels only signal refetch). Whenever a game's log
  grows, after the write has committed, everyone watching that game is told so, and nothing else: what changed is for
  each reader to fetch through their own view, so a signal can never carry anything a reader shouldn't see.

  `over: true` says the game has been released and no signal will follow.
  """

  def subscribe(id), do: Phoenix.PubSub.subscribe(GitGame.PubSub, topic(id))

  def broadcast(id, over),
    do: Phoenix.PubSub.broadcast(GitGame.PubSub, topic(id), {:refetch, %{over: over}})

  defp topic(id), do: "game:" <> id
end
