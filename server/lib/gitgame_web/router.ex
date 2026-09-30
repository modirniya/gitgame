defmodule GitGameWeb.Router do
  use GitGameWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/api", GitGameWeb do
    pipe_through :api

    get "/health", HealthController, :show
  end
end
