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
    assert %{"day_length" => "live", "deadline" => deadline} = game
    assert {:ok, _, 0} = DateTime.from_iso8601(deadline)
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
    # the cost table names every op; nothing else may
    refute inspect(Map.delete(view, "costs")) =~ "pull"
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

  test "GET ?player= shows that player their own cards, and nobody else's", %{conn: conn} do
    %{"id" => id} = create(conn)
    ana = conn |> get(~p"/api/games/#{id}?player=ana") |> json_response(200)
    raj = conn |> get(~p"/api/games/#{id}?player=raj") |> json_response(200)

    assert %{"player" => "ana", "hand" => hand, "staged" => [], "local" => [], "armed" => []} =
             ana["you"]

    assert length(hand) == 7
    raj_cards = Enum.map(raj["you"]["hand"], & &1["id"])
    refute Enum.any?(raj_cards, &(inspect(ana) =~ ~s("#{&1}")))

    # today's draw: ana sees her own cards, and only how many raj drew
    assert %{"cards" => [_, _]} =
             Enum.find(ana["today"], &(&1["type"] == "drew" and &1["player"] == "ana"))

    assert %{"count" => 2} =
             Enum.find(ana["today"], &(&1["type"] == "drew" and &1["player"] == "raj"))

    assert %{"error" => _} = conn |> get(~p"/api/games/#{id}?player=kim") |> json_response(403)
  end

  test "the view says who the bots are and what each op costs under this game's rules", %{
    conn: conn
  } do
    game = create(conn, %{"seats" => ["ana", "bot"], "bots" => ["bot"], "seed" => 42})

    assert game["bots"] == ["bot"]

    assert %{"ops" => %{"pull" => 1, "pull_rebase" => 2, "pull_when_up_to_date" => 0}} =
             game["costs"]

    assert game["costs"]["commands"] == %{
             "blame" => 1,
             "force" => 1,
             "reflog" => 0,
             "revert" => 1
           }
  end

  describe "replay (M7)" do
    setup %{conn: conn} do
      %{"id" => id} =
        game = create(conn, %{"seats" => ["hal", "eve"], "bots" => ["hal", "eve"], "seed" => 7})

      %{id: id, game: game}
    end

    test "GET /days/:day is the game as that day closed; the last day is the game as it ended", %{
      conn: conn,
      id: id,
      game: game
    } do
      start = conn |> get(~p"/api/games/#{id}/days/0") |> json_response(200)
      assert %{"day" => 1, "days" => [], "released" => nil, "deadline" => nil} = start
      assert [%{"initial" => true}] = start["main"]

      for n <- 1..length(game["days"]) do
        view = conn |> get(~p"/api/games/#{id}/days/#{n}") |> json_response(200)
        assert length(view["days"]) == n
        assert view["days"] == Enum.take(game["days"], n)
      end

      last = conn |> get(~p"/api/games/#{id}/days/#{length(game["days"])}") |> json_response(200)
      assert last == game
    end

    test "a replay can be read as one player, with their cards as they were", %{
      conn: conn,
      id: id
    } do
      view = conn |> get(~p"/api/games/#{id}/days/1?player=hal") |> json_response(200)
      assert %{"you" => %{"player" => "hal", "hand" => [_ | _]}} = view

      assert conn |> get(~p"/api/games/#{id}/days/1?player=kim") |> json_response(403)
    end

    test "a day that hasn't closed, or isn't a day, is 404", %{conn: conn, id: id} do
      assert %{"error" => "fatal: day 99 hasn't closed"} =
               conn |> get(~p"/api/games/#{id}/days/99") |> json_response(404)

      assert conn |> get(~p"/api/games/#{id}/days/-1") |> json_response(404)
      assert conn |> get(~p"/api/games/#{id}/days/one") |> json_response(404)
    end
  end

  describe "bots (charter decision 12)" do
    test "a game of bots plays itself to the release through the API alone", %{conn: conn} do
      game =
        conn
        |> post(~p"/api/games", %{
          "seats" => ["hal", "eve"],
          "bots" => ["hal", "eve"],
          "seed" => 7
        })
        |> json_response(201)

      assert %{"released" => %{"production_down" => _}} = game
      assert length(game["days"]) <= game["final_day"]
    end

    test "a person plays a bot through the API: each pack sent closes the day, since the bot has already sent",
         %{conn: conn} do
      %{"id" => id} =
        conn
        |> post(~p"/api/games", %{"seats" => ["ana", "bot"], "bots" => ["bot"], "seed" => 7})
        |> json_response(201)

      final = play_as_ana(conn, id, 0)

      assert final["released"]

      assert Enum.any?(final["days"], fn day ->
               Enum.any?(day["log"], &(&1["player"] == "bot" and &1["type"] == "push_accepted"))
             end)
    end

    test "a bot must have a seat", %{conn: conn} do
      assert %{"error" => "fatal: every bot must have a seat"} =
               conn
               |> post(~p"/api/games", %{"seats" => ["ana", "raj"], "bots" => ["hal"]})
               |> json_response(422)
    end
  end

  # ana ships her biggest card every day, the way a script calling the API would.
  defp play_as_ana(conn, id, day) do
    view = conn |> get(~p"/api/games/#{id}?player=ana") |> json_response(200)

    if view["released"] || day > 20 do
      view
    else
      card =
        view["you"]["hand"]
        |> Enum.filter(&(&1["kind"] == "commit"))
        |> Enum.max_by(& &1["lines"], fn -> nil end)

      build =
        if card, do: [%{"op" => "add", "cards" => [card["id"]]}, %{"op" => "commit"}], else: []

      body = %{
        "player" => "ana",
        "version" => view["version"],
        "ops" => [%{"op" => "pull"}, %{"op" => "push"}] ++ build
      }

      conn |> post(~p"/api/games/#{id}/packs", body) |> json_response(202)
      play_as_ana(conn, id, day + 1)
    end
  end
end
