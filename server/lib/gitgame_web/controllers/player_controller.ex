defmodule GitGameWeb.PlayerController do
  @moduledoc """
  Players and sessions (ADR-0005). `POST /api/players` is the whole of signing up: an anonymous player and a signed-in
  device in one request. `GET /api/session` says who this device is; `DELETE /api/session` signs it out.
  """
  use GitGameWeb, :controller
  alias GitGame.{Beta, GitHub, Players}
  alias GitGame.Players.Player
  alias GitGameWeb.Plugs.Identity

  action_fallback GitGameWeb.FallbackController

  # A device asking who it is has just opened the game, and the beta counts that as a visit (M12); `via` says what
  # brought it back, once notifications exist. A device already signed in keeps its player: pressing "play" twice
  # never makes two of you.
  def create(%{assigns: %{player: %Player{} = player}} = conn, params) do
    Beta.visit(player, params["via"])
    json(conn, me(player))
  end

  def create(conn, params) do
    with {:ok, player} <- Players.create_anonymous() do
      Beta.visit(player, params["via"])
      {token, expires_at} = Players.sign_in(player)

      conn
      |> Identity.put(token, expires_at)
      |> put_status(:created)
      |> json(me(player))
    end
  end

  def show(%{assigns: %{player: %Player{} = player}} = conn, params) do
    Beta.visit(player, params["via"])
    json(conn, me(player))
  end

  def show(_conn, _params), do: {:error, :unauthorized, "fatal: not signed in"}

  # whether this server can link GitHub at all, so the client offers it only where it can
  defp me(player), do: %{player: Player.public(player), link_github: GitHub.enabled?()}

  def delete(conn, _params) do
    Players.sign_out(conn.assigns.session_token)
    conn |> Identity.drop() |> send_resp(:no_content, "")
  end
end
