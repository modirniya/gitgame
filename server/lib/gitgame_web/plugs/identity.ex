defmodule GitGameWeb.Plugs.Identity do
  @moduledoc """
  Who is asking: the player the `gitgame_session` cookie signs in, as `conn.assigns.player`, or nil (ADR-0005). The
  cookie is `HttpOnly`, so no script on the page can read it, `SameSite=Lax`, and `Secure` wherever there is TLS.
  A session in use is extended, and so is its cookie.
  """
  import Plug.Conn
  alias GitGame.Players

  @cookie "gitgame_session"

  def init(opts), do: opts

  def call(conn, _opts) do
    conn = fetch_cookies(conn)
    token = conn.req_cookies[@cookie]

    case Players.from_token(token) do
      {player, expires_at} ->
        conn |> assign(:player, player) |> assign(:session_token, token) |> put(token, expires_at)

      nil ->
        conn |> assign(:player, nil) |> assign(:session_token, nil)
    end
  end

  @doc "Signs this response's device in: sets the session cookie."
  def put(conn, token, expires_at) do
    put_resp_cookie(conn, @cookie, token,
      http_only: true,
      same_site: "Lax",
      secure: Application.get_env(:gitgame, :secure_cookies, true),
      max_age: max(DateTime.diff(expires_at, DateTime.utc_now()), 0)
    )
  end

  @doc "Signs this response's device out: clears the session cookie."
  def drop(conn), do: delete_resp_cookie(conn, @cookie, http_only: true, same_site: "Lax")
end
