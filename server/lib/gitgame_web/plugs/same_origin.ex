defmodule GitGameWeb.Plugs.SameOrigin do
  @moduledoc """
  Refuses a write that a browser says came from another site (ADR-0005). The session cookie is `SameSite=Lax` and
  every write is JSON, which another origin can't send without a CORS preflight this API never grants; this is the
  third lock on the same door. A request with no `Origin` (curl, a script, a test) is no cross-site forgery, and passes.

  The allowed origins are the endpoint's own URL and `config :gitgame, :origins` (the Vite dev server, in development).
  """
  import Plug.Conn

  @writes ~w(POST PUT PATCH DELETE)

  def init(opts), do: opts

  def call(%{method: method} = conn, _opts) when method in @writes do
    case get_req_header(conn, "origin") do
      [] -> conn
      [origin | _] -> if origin in allowed(), do: conn, else: refuse(conn, origin)
    end
  end

  def call(conn, _opts), do: conn

  defp allowed, do: [GitGameWeb.Endpoint.url() | Application.get_env(:gitgame, :origins, [])]

  defp refuse(conn, origin) do
    conn
    |> put_resp_content_type("application/json")
    |> send_resp(403, JSON.encode!(%{error: "fatal: a write from #{origin} is refused"}))
    |> halt()
  end
end
