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

    get "/games", GameController, :index
    post "/games", GameController, :create
    get "/games/:id", GameController, :show
    get "/games/:id/days/:day", GameController, :day
    post "/games/:id/packs", GameController, :send_pack
    get "/games/:id/feedback", FeedbackController, :show
    put "/games/:id/feedback", FeedbackController, :update

    get "/email", EmailController, :show
    put "/email", EmailController, :update
    delete "/email", EmailController, :delete

    get "/push", PushController, :key
    post "/push/subscriptions", PushController, :subscribe
    delete "/push/subscriptions", PushController, :unsubscribe

    post "/rooms", RoomController, :create
    get "/rooms/:code", RoomController, :show
    patch "/rooms/:code", RoomController, :update
    post "/rooms/:code/join", RoomController, :join
    post "/rooms/:code/start", RoomController, :start
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

  # The links in emails: page navigations from a mail client, and its one-click unsubscribe POST (RFC 8058).
  scope "/api/email", GitGameWeb do
    get "/confirm", EmailController, :confirm
    get "/unsubscribe", EmailController, :unsubscribe
    post "/unsubscribe", EmailController, :unsubscribe
  end

  # The landing page and the game, from the same origin as everything under /api (ADR-0005, ADR-0009).
  scope "/", GitGameWeb do
    get "/", ClientController, :landing
    get "/play", ClientController, :play
  end

  # Server-Sent Events: the browser asks for text/event-stream, which the JSON pipeline would refuse.
  scope "/api", GitGameWeb do
    get "/games/:id/live", LiveController, :show
    get "/rooms/:code/live", LiveController, :room
  end
end
