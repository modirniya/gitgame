defmodule GitGameWeb.Plugs.StatsToken do
  @moduledoc """
  The lock on the maintainer's pulse (M13e): `/stats` and `/api/stats` answer only to `STATS_TOKEN`, given as HTTP
  Basic auth's password with any user name, so a browser asks for it once and sends it again with the page's own
  requests. Until the token is set, both paths answer as if they weren't there.
  """
  import Plug.Conn

  def init(opts), do: opts

  def call(conn, _opts) do
    case Application.get_env(:gitgame, :stats_token) do
      token when token in [nil, ""] ->
        conn
        |> put_resp_content_type("application/json")
        |> send_resp(404, JSON.encode!(%{errors: %{detail: "Not Found"}}))
        |> halt()

      token ->
        with {_user, given} <- Plug.BasicAuth.parse_basic_auth(conn),
             true <- Plug.Crypto.secure_compare(given, token) do
          conn
        else
          _ -> conn |> Plug.BasicAuth.request_basic_auth(realm: "stats") |> halt()
        end
    end
  end
end
