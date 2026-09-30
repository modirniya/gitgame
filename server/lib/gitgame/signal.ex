defmodule GitGame.Signal do
  @moduledoc """
  "Something changed: fetch again" (charter decision 9: push channels only signal refetch). Whenever a game's log
  grows, or a room changes, after the write has committed, everyone watching it is told so, and nothing else: what
  changed is for each reader to fetch through their own view, so a signal can never carry anything a reader shouldn't
  see.

  What is watched is `{:game, id}` or `{:room, code}`. `over: true` says no signal will follow: the game has been
  released, or the room's game has started.
  """

  def subscribe(what), do: Phoenix.PubSub.subscribe(GitGame.PubSub, topic(what))

  def broadcast(what, over),
    do: Phoenix.PubSub.broadcast(GitGame.PubSub, topic(what), {:refetch, %{over: over}})

  defp topic({:game, id}), do: "game:" <> id
  defp topic({:room, code}), do: "room:" <> code
end
