defmodule GitGameWeb.ClientController do
  @moduledoc """
  The client's page, served from the API's own origin so the session cookie works (ADR-0005). The client routes by
  the address's hash, so `/` is the only page; its scripts, styles and icons are static files beside it.

  The page carries a Content Security Policy: scripts, styles and connections only from this origin, images also from
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

  def index(conn, _params) do
    page =
      Application.get_env(:gitgame, :client_page) ||
        Application.app_dir(:gitgame, "priv/static/index.html")

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
