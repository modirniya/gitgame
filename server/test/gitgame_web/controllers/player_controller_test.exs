defmodule GitGameWeb.PlayerControllerTest do
  use GitGameWeb.ConnCase, async: true

  defp cookie(conn), do: conn.resp_cookies["gitgame_session"]

  test "POST /api/players: an anonymous player, and this device signed in as them", %{conn: conn} do
    conn = post(conn, ~p"/api/players")

    assert %{"player" => %{"id" => _, "handle" => handle, "github" => nil}} =
             json_response(conn, 201)

    assert handle =~ ~r/-/

    %{value: token, http_only: true, same_site: "Lax", secure: secure, max_age: max_age} =
      cookie(conn)

    assert is_binary(token)
    assert secure == Application.get_env(:gitgame, :secure_cookies, true)
    assert max_age > 360 * 24 * 3600
  end

  test "signed in, the device knows who it is; pressing play again doesn't make a second player",
       %{
         conn: conn
       } do
    conn = post(conn, ~p"/api/players")
    %{"player" => me} = json_response(conn, 201)

    # Phoenix.ConnTest carries the response's cookies into the next request, as a browser would
    assert %{"player" => ^me} = conn |> get(~p"/api/session") |> json_response(200)
    assert %{"player" => ^me} = conn |> post(~p"/api/players") |> json_response(200)
  end

  test "signed out, or never signed in, the device is nobody", %{conn: conn} do
    assert %{"error" => "fatal: not signed in"} =
             build_conn() |> get(~p"/api/session") |> json_response(401)

    conn = post(conn, ~p"/api/players")
    conn = delete(conn, ~p"/api/session")
    assert response(conn, 204)
    assert %{max_age: 0} = cookie(conn)
    assert conn |> get(~p"/api/session") |> json_response(401)
  end

  test "a write another site's page sends is refused; the page's own origin, and no origin at all, pass",
       %{conn: conn} do
    assert %{"error" => "fatal: a write from https://evil.example is refused"} =
             conn
             |> put_req_header("origin", "https://evil.example")
             |> post(~p"/api/players")
             |> json_response(403)

    assert conn
           |> put_req_header("origin", GitGameWeb.Endpoint.url())
           |> post(~p"/api/players")
           |> json_response(201)

    assert build_conn() |> post(~p"/api/players") |> json_response(201)

    # reads are never refused for their origin: a GET changes nothing
    assert build_conn()
           |> put_req_header("origin", "https://evil.example")
           |> get(~p"/api/health")
           |> json_response(200)
  end

  test "opening the game marks a visit for the beta (M12), once a day", %{conn: conn} do
    conn = post(conn, ~p"/api/players")
    conn |> get(~p"/api/session") |> json_response(200)
    conn |> get(~p"/api/session?via=notification") |> json_response(200)

    assert [%{kind: "visit", via: nil}] = GitGame.Repo.all(GitGame.Beta.Mark)
  end
end
