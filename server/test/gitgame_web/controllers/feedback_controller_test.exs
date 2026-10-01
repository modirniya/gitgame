defmodule GitGameWeb.FeedbackControllerTest do
  use GitGameWeb.ConnCase, async: true
  alias GitGame.{Feedback, Games}

  defp game(conn) do
    %{"id" => id} = conn |> post(~p"/api/games", %{"bots" => ["bot"]}) |> json_response(201)
    id
  end

  test "a note on a game once it's over, from someone who held a seat: kept, read back and rewritten" do
    conn = post(build_conn(), ~p"/api/players")
    id = game(conn)

    assert %{"body" => nil, "max" => 1000} =
             conn |> get(~p"/api/games/#{id}/feedback") |> json_response(200)

    assert %{"error" => "fatal: the game isn't over yet"} =
             conn |> put(~p"/api/games/#{id}/feedback", %{"body" => "fun"}) |> json_response(409)

    for _ <- 1..12, do: Games.close_day(id)

    # trimmed, line breaks kept, and the escape that would start a terminal sequence dropped
    assert %{"body" => "the conflicts were\n[2Jconfusing"} =
             conn
             |> put(~p"/api/games/#{id}/feedback", %{
               "body" => "  the conflicts were\r\n\e[2Jconfusing  "
             })
             |> json_response(200)

    assert %{"body" => "fun, again"} =
             conn
             |> put(~p"/api/games/#{id}/feedback", %{"body" => "fun, again"})
             |> json_response(200)

    assert %{"body" => "fun, again"} =
             conn |> get(~p"/api/games/#{id}/feedback") |> json_response(200)

    assert [%{body: "fun, again"}] = Feedback.list()

    for body <- ["", "   ", String.duplicate("x", 1001), nil] do
      assert %{"error" => "fatal: a note is 1 to 1000 characters"} =
               conn |> put(~p"/api/games/#{id}/feedback", %{"body" => body}) |> json_response(422)
    end

    assert conn
           |> put(~p"/api/games/#{id}/feedback", %{"body" => String.duplicate("é", 1000)})
           |> json_response(200)
  end

  test "nobody else leaves a note on a game: not signed in, nor without a seat in it" do
    conn = post(build_conn(), ~p"/api/players")
    id = game(conn)
    for _ <- 1..12, do: Games.close_day(id)

    assert build_conn()
           |> put(~p"/api/games/#{id}/feedback", %{"body" => "hi"})
           |> json_response(401)

    assert build_conn() |> get(~p"/api/games/#{id}/feedback") |> json_response(401)

    other = post(build_conn(), ~p"/api/players")

    assert %{"error" => "fatal: you hold no seat in this game"} =
             other |> put(~p"/api/games/#{id}/feedback", %{"body" => "hi"}) |> json_response(403)

    assert other
           |> put(~p"/api/games/#{Ecto.UUID.generate()}/feedback", %{"body" => "hi"})
           |> json_response(404)

    assert Feedback.list() == []
  end
end
