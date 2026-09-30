defmodule GitGame.Notifications.Channel do
  @moduledoc """
  A way a notification reaches a player (ADR-0006): Web Push (M10b), email (M10c). `config :gitgame,
  :notification_channels` lists the ones this server sends on.
  """

  @typedoc """
  What a notification says. `path` is the client's address for the game; each channel adds where it came from
  (`?via=`), so the beta counts the visit apart (M12).
  """
  @type message :: %{
          kind: String.t(),
          game_id: String.t(),
          day: integer(),
          title: String.t(),
          body: String.t(),
          path: String.t()
        }

  @doc "The channel's name, as `notifications.channel` records it."
  @callback name() :: String.t()

  @doc "Whether this player can be reached this way at all: a push subscription, a confirmed address."
  @callback reaches?(GitGame.Players.Player.t()) :: boolean()

  @doc "Sends it. A failure is logged by the channel; the notification still counts as sent, so it is never retried twice."
  @callback deliver(GitGame.Players.Player.t(), message()) :: :ok
end
