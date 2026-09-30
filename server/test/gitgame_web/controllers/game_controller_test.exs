defmodule GitGameWeb.GameControllerTest do
  use GitGameWeb.ConnCase, async: true
  alias GitGame.Games

  defp create(conn, body \\ %{"seats" => ["ana", "raj"], "seed" => 42}),
    do: conn |> post(~p"/api/games", body) |> json_response(201)

  test "POST /api/games creates a game and returns its public view, day 1 open", %{conn: conn} do
    game = create(conn)

    assert %{
             "id" => _,
             "version" => 1,
             "day" => 1,
             "seats" => ["ana", "raj"],
             "sent_today" => [],
             "released" => nil
           } = game

    assert [%{"initial" => true}] = game["main"]

    assert %{"hand" => 7, "staged" => 0, "to_push" => 0, "pointer" => 1, "behind" => 0} =
             game["players"]["ana"]

    assert %{"id" => _, "name" => _} = game["incident"]
  end

  test "POST /api/games refuses a game that can't exist", %{conn: conn} do
    assert %{"error" => "a game needs 2 to 5 different players" <> _} =
             conn |> post(~p"/api/games", %{"seats" => ["ana"]}) |> json_response(422)

    assert %{"error" => _} = conn |> post(~p"/api/games", %{}) |> json_response(422)
  end

  test "GET /api/games/:id fetches the view; an unknown game is 404", %{conn: conn} do
    %{"id" => id} = create(conn)
    assert %{"id" => ^id, "day" => 1} = conn |> get(~p"/api/games/#{id}") |> json_response(200)

    assert %{"error" => _} =
             conn |> get(~p"/api/games/#{Ecto.UUID.generate()}") |> json_response(404)

    assert %{"error" => _} = conn |> get(~p"/api/games/not-a-game") |> json_response(404)
  end

  test "POST a pack: accepted, and everyone can see that ana has sent hers (but not what's in it)",
       %{conn: conn} do
    %{"id" => id} = create(conn)
    body = %{"player" => "ana", "version" => 1, "ops" => [%{"op" => "pull"}], "discard" => []}

    assert %{"version" => 1} =
             conn |> post(~p"/api/games/#{id}/packs", body) |> json_response(202)

    view = conn |> get(~p"/api/games/#{id}") |> json_response(200)
    assert view["sent_today"] == ["ana"]
    refute inspect(view) =~ "pull"
  end

  test "a pack written before the day closed is 409, in Git's words; the client refetches", %{
    conn: conn
  } do
    %{"id" => id} = create(conn)
    {:ok, _} = Games.close_day(id)

    body = %{"player" => "ana", "version" => 1, "ops" => []}

    assert %{"error" => "! [rejected]        main -> main (fetch first)"} =
             conn |> post(~p"/api/games/#{id}/packs", body) |> json_response(409)

    assert %{"version" => v} = conn |> get(~p"/api/games/#{id}") |> json_response(200)

    assert %{"version" => ^v} =
             conn
             |> post(~p"/api/games/#{id}/packs", %{body | "version" => v})
             |> json_response(202)
  end

  test "a pack that isn't one is 422; a stranger's is 403", %{conn: conn} do
    %{"id" => id} = create(conn)
    bad = %{"player" => "ana", "version" => 1, "ops" => [%{"op" => "yolo"}]}

    assert %{"error" => "git: 'yolo' is not a git command. See 'git --help'."} =
             conn |> post(~p"/api/games/#{id}/packs", bad) |> json_response(422)

    assert %{"error" => _} =
             conn
             |> post(~p"/api/games/#{id}/packs", %{bad | "player" => "kim", "ops" => []})
             |> json_response(403)

    assert %{"error" => _} =
             conn |> post(~p"/api/games/#{id}/packs", %{"ops" => []}) |> json_response(422)
  end
end
