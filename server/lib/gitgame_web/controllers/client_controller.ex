defmodule GitGameWeb.ClientController do
  @moduledoc """
  The client's pages, served from the API's own origin so the session cookie works (ADR-0005): the landing page at
  `/`, the game at `/play` (ADR-0009), and the maintainer's pulse at `/stats` behind its token (M13e). The game routes
  by the address's hash, so `/play` is its only page; the scripts, styles and icons of all three are static files beside
  them.

  Links from before the game moved to `/play` that carry a query (`/?via=…` from notifications and emails, `/?email=…`,
  `/?github=…`) are sent on to `/play` with it, and the browser keeps their `#/…`. A link with only a hash never
  reaches the server; the landing page's own script sends it on.

  Every page carries a Content Security Policy: scripts, styles and connections only from this origin, images also from
  GitHub's avatars, and no framing. Cards set CSS custom properties through `style` attributes, which the policy
  allows (`style-src-attr`) without allowing any inline script.
  """
  use GitGameWeb, :controller

  @csp Enum.join(
         [
           "default-src 'self'",
           "img-src 'self' https://avatars.githubusercontent.com",
           "style-src 'self'",
           "style-src-attr 'unsafe-inline'",
           "base-uri 'none'",
           "frame-ancestors 'none'",
           "form-action 'self'"
         ],
         "; "
       )

  # the queries only links to the game ever carried; anything else (a campaign's `?utm_…`) stays on the landing page
  @moved ~w(via email github)

  def landing(conn, params) do
    if Enum.any?(@moved, &Map.has_key?(params, &1)),
      do: redirect(conn, to: "/play?" <> conn.query_string),
      else: page(conn, "index.html")
  end

  def play(conn, _params), do: page(conn, "play/index.html")

  # the maintainer's pulse (M13e); the router has already checked the token
  def stats(conn, _params), do: page(conn, "stats/index.html")

  defp page(conn, file) do
    dir =
      Application.get_env(:gitgame, :client_dir) || Application.app_dir(:gitgame, "priv/static")

    page = Path.join(dir, file)

    if File.exists?(page) do
      conn
      |> put_resp_header("content-security-policy", @csp)
      |> put_resp_header("x-content-type-options", "nosniff")
      |> put_resp_header("referrer-policy", "same-origin")
      # a new deploy must reach the next visit: the page is small, its assets are named by their contents
      |> put_resp_header("cache-control", "no-cache")
      |> put_resp_content_type("text/html")
      |> send_file(200, page)
    else
      conn
      |> put_status(:not_found)
      |> json(%{
        error:
          "fatal: the client isn't built here; in development it is the Vite server (web/README.md)"
      })
    end
  end
end
