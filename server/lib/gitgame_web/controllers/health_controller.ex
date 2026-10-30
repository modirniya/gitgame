defmodule GitGameWeb.HealthController do
  @moduledoc """
  `GET /api/health`: whether the server is up and can reach its database. Every game is an event log in Postgres
  (charter decision 8), so a server that can't reach it is not healthy, however well the web layer answers.

  It also says which version is running and where its source is: the AGPL's offer (section 13), the same tree the
  client's footers link (web/src/source.js). A deploy is the tag `v<version>` (docs/workflow.md).
  """
  use GitGameWeb, :controller

  @version Mix.Project.config()[:version]
  @source "https://github.com/modirniya/gitgame/tree/v#{@version}"

  def show(conn, _params) do
    about = %{service: GitGame.Brand.name(), version: @version, source: @source}

    case Ecto.Adapters.SQL.query(GitGame.Repo, "SELECT 1", []) do
      {:ok, _} ->
        json(conn, Map.merge(about, %{status: "ok", database: "ok"}))

      {:error, _} ->
        conn
        |> put_status(:service_unavailable)
        |> json(Map.merge(about, %{status: "unavailable", database: "unreachable"}))
    end
  end
end
