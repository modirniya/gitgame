defmodule GitGameWeb.PlayerController do
  @moduledoc """
  Players and sessions (ADR-0005). `POST /api/players` is the whole of signing up: an anonymous player and a signed-in
  device in one request. `GET /api/session` says who this device is; `DELETE /api/session` signs it out.
  """
  use GitGameWeb, :controller
  alias GitGame.Players
  alias GitGame.Players.Player
  alias GitGameWeb.Plugs.Identity

  action_fallback GitGameWeb.FallbackController

  # A device already signed in keeps its player: pressing "play" twice never makes two of you.
  def create(%{assigns: %{player: %Player{} = player}} = conn, _params),
    do: json(conn, %{player: Player.public(player)})

  def create(conn, _params) do
    with {:ok, player} <- Players.create_anonymous() do
      {token, expires_at} = Players.sign_in(player)

      conn
      |> Identity.put(token, expires_at)
      |> put_status(:created)
      |> json(%{player: Player.public(player)})
    end
  end

  def show(%{assigns: %{player: %Player{} = player}} = conn, _params),
    do: json(conn, %{player: Player.public(player)})

  def show(_conn, _params), do: {:error, :unauthorized, "fatal: not signed in"}

  def delete(conn, _params) do
    Players.sign_out(conn.assigns.session_token)
    conn |> Identity.drop() |> send_resp(:no_content, "")
  end
end
