defmodule GitGameWeb.Router do
  use GitGameWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
    plug GitGameWeb.Plugs.SameOrigin
    plug GitGameWeb.Plugs.Identity
  end

  scope "/api", GitGameWeb do
    pipe_through :api

    get "/health", HealthController, :show

    post "/players", PlayerController, :create
    get "/session", PlayerController, :show
    delete "/session", PlayerController, :delete

    post "/games", GameController, :create
    get "/games/:id", GameController, :show
    get "/games/:id/days/:day", GameController, :day
    post "/games/:id/packs", GameController, :send_pack
  end

  # Linking GitHub: browser navigations, not JSON calls, and the flow's state lives in the signed session cookie.
  pipeline :auth do
    plug :fetch_session
    plug GitGameWeb.Plugs.Identity
  end

  scope "/api/auth", GitGameWeb do
    pipe_through :auth

    get "/github", AuthController, :github
    get "/github/callback", AuthController, :callback
  end

  # Server-Sent Events: the browser asks for text/event-stream, which the JSON pipeline would refuse.
  scope "/api", GitGameWeb do
    get "/games/:id/live", LiveController, :show
  end
end
