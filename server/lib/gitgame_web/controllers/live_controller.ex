defmodule GitGameWeb.LiveController do
  @moduledoc """
  `GET /api/games/:id/live` and `GET /api/rooms/:code/live`: Server-Sent Events streams that say `refetch` whenever the
  game's log grows or the room changes, and nothing more (charter decision 9; `GitGame.Signal`). It carries no game data, so it needs no viewer and can leak
  nothing. SSE rather than a socket because a browser's `EventSource` reconnects on its own, and a reconnect here is
  just another refetch: there is nothing to resume.

  The first event is sent at once, so a client acts the same way on connecting as on any change. A game's stream ends
  after the release, and a room's once its game has started, since nothing will change again.
  """
  use GitGameWeb, :controller
  alias GitGame.{Games, Rooms, Signal}

  action_fallback GitGameWeb.FallbackController

  # A comment line now and then, so proxies don't take a quiet day for a dead connection.
  @keepalive :timer.seconds(25)

  def show(conn, %{"id" => id}) do
    with {:ok, id} <- Ecto.UUID.cast(id) |> found(id),
         :ok <- Signal.subscribe({:game, id}),
         {:ok, state} <- Games.load(id),
         do: open(conn, state.game.released != nil)
  end

  def room(conn, %{"code" => code}) do
    with :ok <- Signal.subscribe({:room, code}),
         {:ok, room} <- Rooms.get(code),
         do: open(conn, room.game_id != nil)
  end

  # subscribed before reading, so no change can fall between the read and the stream
  defp open(conn, over) do
    conn
    |> put_resp_header("content-type", "text/event-stream")
    |> put_resp_header("cache-control", "no-cache")
    |> send_chunked(200)
    |> stream(over)
  end

  defp found({:ok, id}, _), do: {:ok, id}
  defp found(:error, id), do: {:error, :not_found, "fatal: no game #{id}"}

  defp stream(conn, over) do
    case chunk(conn, "event: refetch\ndata: #{JSON.encode!(%{over: over})}\n\n") do
      {:ok, conn} when over -> conn
      {:ok, conn} -> wait(conn)
      {:error, _closed} -> conn
    end
  end

  defp wait(conn) do
    receive do
      {:refetch, %{over: over}} -> stream(conn, over)
    after
      @keepalive ->
        case chunk(conn, ": keepalive\n\n") do
          {:ok, conn} -> wait(conn)
          {:error, _closed} -> conn
        end
    end
  end
end
