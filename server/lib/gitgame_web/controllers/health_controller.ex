defmodule GitGameWeb.HealthController do
  @moduledoc """
  `GET /api/health`: whether the server is up and can reach its database. Every game is an event log in Postgres
  (charter decision 8), so a server that can't reach it is not healthy, however well the web layer answers.
  """
  use GitGameWeb, :controller

  def show(conn, _params) do
    case Ecto.Adapters.SQL.query(GitGame.Repo, "SELECT 1", []) do
      {:ok, _} ->
        json(conn, %{status: "ok", service: GitGame.Brand.name(), database: "ok"})

      {:error, _} ->
        conn
        |> put_status(:service_unavailable)
        |> json(%{status: "unavailable", service: GitGame.Brand.name(), database: "unreachable"})
    end
  end
end
