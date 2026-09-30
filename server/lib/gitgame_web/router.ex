defmodule GitGameWeb.Router do
  use GitGameWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/api", GitGameWeb do
    pipe_through :api

    get "/health", HealthController, :show

    post "/games", GameController, :create
    get "/games/:id", GameController, :show
    get "/games/:id/days/:day", GameController, :day
    post "/games/:id/packs", GameController, :send_pack
  end

  # Server-Sent Events: the browser asks for text/event-stream, which the JSON pipeline would refuse.
  scope "/api", GitGameWeb do
    get "/games/:id/live", LiveController, :show
  end
end
