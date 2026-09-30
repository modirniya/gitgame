defmodule GitGameWeb.RoomController do
  @moduledoc """
  Rooms by link (M9): open one, look at it, join it, set it up, start its game. Anyone with the link can look; joining
  and everything after needs a signed-in device, which any visitor has after one request (ADR-0005).
  """
  use GitGameWeb, :controller
  alias GitGame.Rooms

  action_fallback GitGameWeb.FallbackController

  plug :signed_in when action in [:create, :join, :update, :start]
  # rooms and games share a count: either is a thing one player makes
  plug GitGameWeb.Plugs.RateLimit, [bucket: :games, by: :player] when action == :create

  def create(conn, _params) do
    with {:ok, room} <- Rooms.open(conn.assigns.player),
         do: conn |> put_status(:created) |> show_room(room)
  end

  def show(conn, %{"code" => code}), do: reply(conn, code)

  def join(conn, %{"code" => code}) do
    with {:ok, _} <- Rooms.join(code, conn.assigns.player), do: reply(conn, code)
  end

  def update(conn, %{"code" => code} = params) do
    with {:ok, _} <-
           Rooms.update(code, conn.assigns.player, Map.take(params, ["bots", "day_length"])),
         do: reply(conn, code)
  end

  def start(conn, %{"code" => code}) do
    with {:ok, _game} <- Rooms.start(code, conn.assigns.player), do: reply(conn, code)
  end

  defp reply(conn, code) do
    case Rooms.get(code) do
      {:ok, room} -> show_room(conn, room)
      {:error, :not_found} -> {:error, :not_found, "fatal: no room #{code}"}
    end
  end

  defp show_room(conn, room), do: json(conn, Rooms.view(room, conn.assigns.player))

  defp signed_in(%{assigns: %{player: nil}} = conn, _opts) do
    conn |> put_status(:unauthorized) |> json(%{error: "fatal: not signed in"}) |> halt()
  end

  defp signed_in(conn, _opts), do: conn
end
