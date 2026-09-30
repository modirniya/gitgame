defmodule GitGameWeb.Plugs.ClientIP do
  @moduledoc """
  Who is asking, behind the host's proxy (ADR-0007). Every request reaches the server from the proxy, so without this
  the rate limits (`GitGameWeb.Plugs.RateLimit`) would count everyone as one address. When `config :gitgame,
  :client_ip_header` names the header the proxy sets (on Fly, `fly-client-ip`), `conn.remote_ip` becomes the address
  in it. Only a header the proxy itself sets can be trusted, since a client can send any header it likes, so the
  config is set only where that proxy is in front (`config/runtime.exs`), and nowhere else.
  """
  import Plug.Conn

  def init(opts), do: opts

  def call(conn, _opts) do
    with header when is_binary(header) <- Application.get_env(:gitgame, :client_ip_header),
         [value | _] <- get_req_header(conn, header),
         {:ok, ip} <- value |> String.trim() |> to_charlist() |> :inet.parse_address() do
      %{conn | remote_ip: ip}
    else
      _ -> conn
    end
  end
end
