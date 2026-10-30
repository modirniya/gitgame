defmodule GitGameWeb.HealthControllerTest do
  use GitGameWeb.ConnCase, async: true

  test "GET /api/health answers ok when the database is reachable", %{conn: conn} do
    body = conn |> get(~p"/api/health") |> json_response(200)

    version = Mix.Project.config()[:version]

    assert body == %{
             "status" => "ok",
             "service" => GitGame.Brand.name(),
             "database" => "ok",
             "version" => version,
             "source" => "https://github.com/modirniya/gitgame/tree/v#{version}"
           }
  end
end
