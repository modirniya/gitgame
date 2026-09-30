defmodule GitGameWeb.PushController do
  @moduledoc """
  Web Push for the client (ADR-0006): the key a browser subscribes with, and its subscription kept or dropped. The
  client asks for permission only when a player taps "remind me", after sending a pack in a 24-hour game.
  """
  use GitGameWeb, :controller
  alias GitGame.Push

  action_fallback GitGameWeb.FallbackController

  def key(conn, _params) do
    case Push.public_key() do
      key when is_binary(key) -> json(conn, %{public_key: key})
      _ -> {:error, :not_found, "fatal: reminders by push aren't set up on this server"}
    end
  end

  def subscribe(%{assigns: %{player: nil}}, _params),
    do: {:error, :unauthorized, "fatal: not signed in"}

  def subscribe(conn, params) do
    with :ok <- Push.subscribe(conn.assigns.player, params), do: send_resp(conn, :no_content, "")
  end

  def unsubscribe(%{assigns: %{player: nil}}, _params),
    do: {:error, :unauthorized, "fatal: not signed in"}

  def unsubscribe(conn, %{"endpoint" => endpoint}) do
    Push.unsubscribe(conn.assigns.player, endpoint)
    send_resp(conn, :no_content, "")
  end
end
