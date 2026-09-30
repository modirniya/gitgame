defmodule GitGameWeb do
  @moduledoc """
  The entrypoint for defining your web interface, such
  as controllers, components, channels, and so on.

  This can be used in your application as:

      use GitGameWeb, :controller
      use GitGameWeb, :html

  The definitions below will be executed for every controller,
  component, etc, so keep them short and clean, focused
  on imports, uses and aliases.

  Do NOT define functions inside the quoted expressions
  below. Instead, define additional modules and import
  those modules here.
  """

  @doc """
  The origin people reach the game at: the endpoint's own URL, unless `config :gitgame, :public_url` says otherwise (the
  Vite dev server, in development, which proxies /api here). GitHub is sent back to it, and so is the browser.
  """
  def public_url, do: Application.get_env(:gitgame, :public_url) || GitGameWeb.Endpoint.url()

  # The built client (web/dist, copied into priv/static by the Dockerfile) is served from the same origin as the API,
  # which the session cookie needs (ADR-0005). "/" itself is GitGameWeb.ClientController.
  def static_paths, do: ~w(assets icon.svg manifest.webmanifest sw.js robots.txt)

  def router do
    quote do
      use Phoenix.Router, helpers: false

      # Import common connection and controller functions to use in pipelines
      import Plug.Conn
      import Phoenix.Controller
    end
  end

  def channel do
    quote do
      use Phoenix.Channel
    end
  end

  def controller do
    quote do
      use Phoenix.Controller, formats: [:html, :json]

      import Plug.Conn

      unquote(verified_routes())
    end
  end

  def verified_routes do
    quote do
      use Phoenix.VerifiedRoutes,
        endpoint: GitGameWeb.Endpoint,
        router: GitGameWeb.Router,
        statics: GitGameWeb.static_paths()
    end
  end

  @doc """
  When used, dispatch to the appropriate controller/live_view/etc.
  """
  defmacro __using__(which) when is_atom(which) do
    apply(__MODULE__, which, [])
  end
end
