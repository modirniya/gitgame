defmodule GitGameWeb.HealthControllerTest do
  use GitGameWeb.ConnCase, async: true

  test "GET /api/health answers ok when the database is reachable", %{conn: conn} do
    body = conn |> get(~p"/api/health") |> json_response(200)

    assert body == %{"status" => "ok", "service" => GitGame.Brand.name(), "database" => "ok"}
  end
end
