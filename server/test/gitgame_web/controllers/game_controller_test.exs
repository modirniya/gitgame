defmodule GitGameWeb.GameControllerTest do
  use GitGameWeb.ConnCase, async: true
  alias GitGame.Games

  # A device signed in as a new anonymous player. Phoenix.ConnTest carries the session cookie into every request made
  # from the returned conn, as a browser would.
  defp signed_in(conn \\ build_conn()) do
    conn = post(conn, ~p"/api/players")
    %{"player" => %{"handle" => handle}} = json_response(conn, 201)
    {conn, handle}
  end

  defp create(conn, body \\ %{"hotseat" => ["raj"], "seed" => 42}),
    do: conn |> post(~p"/api/games", body) |> json_response(201)

  setup do
    {conn, me} = signed_in()
    %{conn: conn, me: me}
  end

  test "POST /api/games: you take the first seat, under your handle, and see the game from it", %{
    conn: conn,
    me: me
  } do
    game = create(conn)

    assert %{
             "id" => _,
             "version" => 1,
             "day" => 1,
             "seats" => [^me, "raj"],
             "yours" => [^me, "raj"],
             "sent_today" => [],
             "released" => nil
           } = game

    assert %{"player" => ^me, "hand" => [_, _, _, _, _, _, _]} = game["you"]
    assert [%{"initial" => true}] = game["main"]
    assert %{"hand" => 7, "pointer" => 1, "behind" => 0} = game["players"]["raj"]
    assert %{"id" => _, "name" => _} = game["incident"]
    assert %{"day_length" => "live", "deadline" => deadline} = game
    assert {:ok, _, 0} = DateTime.from_iso8601(deadline)
  end

  test "POST /api/games needs a signed-in device, and refuses a game that can't exist", %{
    conn: conn
  } do
    assert %{"error" => "fatal: not signed in"} =
             build_conn() |> post(~p"/api/games", %{"bots" => ["bot"]}) |> json_response(401)

    assert %{"error" => "a game needs 2 to 5 different players" <> _} =
             conn |> post(~p"/api/games", %{}) |> json_response(422)

    assert %{"error" => "every seat is named by a string"} =
             conn |> post(~p"/api/games", %{"hotseat" => [7]}) |> json_response(422)
  end

  test "GET /api/games/:id; an unknown game is 404", %{conn: conn} do
    %{"id" => id} = create(conn)
    assert %{"id" => ^id, "day" => 1} = conn |> get(~p"/api/games/#{id}") |> json_response(200)
    assert conn |> get(~p"/api/games/#{Ecto.UUID.generate()}") |> json_response(404)
    assert conn |> get(~p"/api/games/not-a-game") |> json_response(404)
  end

  test "a pack is accepted, and the table sees that it is in, not what it holds", %{
    conn: conn,
    me: me
  } do
    %{"id" => id} = create(conn, %{"bots" => ["bot"], "seed" => 42})
    body = %{"version" => 1, "ops" => [%{"op" => "tag"}], "discard" => []}

    assert %{"version" => _} =
             conn |> post(~p"/api/games/#{id}/packs", body) |> json_response(202)

    view = build_conn() |> get(~p"/api/games/#{id}") |> json_response(200)

    # the bot's pack closed the day at once; the day log says ana tried to tag, which is public, as a push would be
    assert view["day"] == 2
    refute Map.has_key?(view, "you")
    assert Enum.any?(hd(view["days"])["log"], &(&1["player"] == me))
  end

  test "a pack written before the day closed is 409, in Git's words; the client refetches", %{
    conn: conn
  } do
    %{"id" => id} = create(conn, %{"bots" => ["bot"], "seed" => 42})
    {:ok, _} = Games.close_day(id)
    body = %{"version" => 1, "ops" => []}

    assert %{"error" => "! [rejected]        main -> main (fetch first)"} =
             conn |> post(~p"/api/games/#{id}/packs", body) |> json_response(409)

    assert %{"version" => v} = conn |> get(~p"/api/games/#{id}") |> json_response(200)

    assert conn
           |> post(~p"/api/games/#{id}/packs", %{body | "version" => v})
           |> json_response(202)
  end

  test "a pack that isn't one is 422", %{conn: conn} do
    %{"id" => id} = create(conn, %{"bots" => ["bot"], "seed" => 42})
    bad = %{"version" => 1, "ops" => [%{"op" => "yolo"}]}

    assert %{"error" => "git: 'yolo' is not a git command. See 'git --help'."} =
             conn |> post(~p"/api/games/#{id}/packs", bad) |> json_response(422)

    assert conn |> post(~p"/api/games/#{id}/packs", %{"ops" => []}) |> json_response(422)
  end

  describe "a seat is its holder's (ADR-0005)" do
    setup %{conn: conn} do
      %{"id" => id} = create(conn)
      {stranger, _} = signed_in()
      %{id: id, stranger: stranger}
    end

    test "you see your own cards; in a hotseat game, each seat you hold", %{
      conn: conn,
      id: id,
      me: me
    } do
      mine = conn |> get(~p"/api/games/#{id}") |> json_response(200)
      raj = conn |> get(~p"/api/games/#{id}?seat=raj") |> json_response(200)

      assert %{"player" => ^me, "hand" => hand} = mine["you"]
      assert %{"player" => "raj"} = raj["you"]
      refute Enum.any?(raj["you"]["hand"], &(inspect(mine) =~ ~s("#{&1["id"]}")))
      assert length(hand) == 7

      # today's draw: your own cards, and only how many the other seat drew
      assert %{"cards" => [_, _]} =
               Enum.find(mine["today"], &(&1["type"] == "drew" and &1["player"] == me))

      assert %{"count" => 2} =
               Enum.find(mine["today"], &(&1["type"] == "drew" and &1["player"] == "raj"))
    end

    test "nobody reads a seat that isn't theirs: others get the table's view", %{
      id: id,
      me: me,
      stranger: stranger
    } do
      for device <- [stranger, build_conn()] do
        view = device |> get(~p"/api/games/#{id}") |> json_response(200)
        refute Map.has_key?(view, "you")
        refute Map.has_key?(view, "yours")

        assert %{"error" => "fatal: " <> _} =
                 device |> get(~p"/api/games/#{id}?seat=#{me}") |> json_response(403)

        assert device |> get(~p"/api/games/#{id}/days/0?seat=raj") |> json_response(403)
      end
    end

    test "nobody writes a seat that isn't theirs", %{
      conn: conn,
      id: id,
      me: me,
      stranger: stranger
    } do
      body = %{"version" => 1, "ops" => []}

      assert %{"error" => "fatal: you hold no seat in this game"} =
               stranger
               |> post(~p"/api/games/#{id}/packs", Map.put(body, "seat", me))
               |> json_response(403)

      assert %{"error" => "fatal: not signed in"} =
               build_conn() |> post(~p"/api/games/#{id}/packs", body) |> json_response(401)

      # holding two seats, you say which one you write for, and only one you hold
      assert %{"error" => "a pack names its \"seat\": you hold several"} =
               conn |> post(~p"/api/games/#{id}/packs", body) |> json_response(422)

      assert %{"error" => "fatal: kim is not your seat"} =
               conn
               |> post(~p"/api/games/#{id}/packs", Map.put(body, "seat", "kim"))
               |> json_response(403)

      assert conn
             |> post(~p"/api/games/#{id}/packs", Map.put(body, "seat", "raj"))
             |> json_response(202)

      assert %{"sent_today" => ["raj"]} = conn |> get(~p"/api/games/#{id}") |> json_response(200)
    end
  end

  test "the view says who the bots are and what each op costs under this game's rules", %{
    conn: conn
  } do
    game = create(conn, %{"bots" => ["bot"], "seed" => 42})

    assert game["bots"] == ["bot"]
    assert game["max_ops"] == 4
    assert game["default_strategy"] == "theirs"

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
      %{"id" => id} = create(conn, %{"bots" => ["bot"], "seed" => 7})
      for _ <- 1..12, do: Games.close_day(id)
      %{id: id, game: conn |> get(~p"/api/games/#{id}") |> json_response(200)}
    end

    test "GET /days/:day is the game as that day closed; the last day is the game as it ended", %{
      conn: conn,
      id: id,
      game: game
    } do
      assert game["released"]
      start = conn |> get(~p"/api/games/#{id}/days/0") |> json_response(200)
      assert %{"day" => 1, "days" => [], "released" => nil, "deadline" => nil} = start
      assert [%{"initial" => true}] = start["main"]

      for n <- 1..length(game["days"]) do
        view = conn |> get(~p"/api/games/#{id}/days/#{n}") |> json_response(200)
        assert view["days"] == Enum.take(game["days"], n)
      end

      assert conn |> get(~p"/api/games/#{id}/days/#{length(game["days"])}") |> json_response(200) ==
               game
    end

    test "a replay is read from your seat, with your cards as they were; others read the table's",
         %{
           conn: conn,
           id: id,
           me: me
         } do
      assert %{"you" => %{"player" => ^me, "hand" => [_ | _]}} =
               conn |> get(~p"/api/games/#{id}/days/1") |> json_response(200)

      refute build_conn()
             |> get(~p"/api/games/#{id}/days/1")
             |> json_response(200)
             |> Map.has_key?("you")
    end

    test "a day that hasn't closed, or isn't a day, is 404", %{conn: conn, id: id} do
      assert %{"error" => "fatal: day 99 hasn't closed"} =
               conn |> get(~p"/api/games/#{id}/days/99") |> json_response(404)

      assert conn |> get(~p"/api/games/#{id}/days/-1") |> json_response(404)
      assert conn |> get(~p"/api/games/#{id}/days/one") |> json_response(404)
    end
  end

  test "a person plays a bot through the API: each pack sent closes the day, since the bot has already sent",
       %{conn: conn} do
    %{"id" => id} = create(conn, %{"bots" => ["bot"], "seed" => 7})
    final = play(conn, id, 0)

    assert final["released"]

    assert Enum.any?(final["days"], fn day ->
             Enum.any?(day["log"], &(&1["player"] == "bot" and &1["type"] == "push_accepted"))
           end)
  end

  test "a guided first game against the bot (M15h): your first push lands on day 1, whatever seed was drawn",
       %{conn: conn, me: me} do
    for _ <- 1..10 do
      game = create(conn, %{"bots" => ["bot"], "day_length" => "lunch", "guided" => true})
      card = Enum.find(game["you"]["hand"], &(&1["kind"] == "commit" and not &1["bug"]))

      ops = [
        %{"op" => "add", "cards" => [card["id"]]},
        %{"op" => "commit"},
        %{"op" => "pull"},
        %{"op" => "push"}
      ]

      # the bot sent its pack as the day opened, so yours closes the day
      conn
      |> post(~p"/api/games/#{game["id"]}/packs", %{"version" => game["version"], "ops" => ops})
      |> json_response(202)

      assert %{"days" => [%{"log" => log}]} =
               conn |> get(~p"/api/games/#{game["id"]}") |> json_response(200)

      assert Enum.any?(log, &(&1["type"] == "push_accepted" and &1["player"] == me))
    end
  end

  describe "your games (M9c)" do
    test "lists the games you hold a seat in: waiting on your pack first, finished last", %{
      conn: conn,
      me: me
    } do
      %{"id" => waiting} = create(conn, %{"hotseat" => ["raj"], "seed" => 1})
      %{"id" => sent} = create(conn, %{"hotseat" => ["kim"], "seed" => 2})
      %{"id" => done} = create(conn, %{"bots" => ["bot"], "seed" => 3})

      for seat <- [me, "kim"] do
        conn |> post(~p"/api/games/#{sent}/packs", %{"version" => 1, "seat" => seat, "ops" => []})
      end

      for _ <- 1..12, do: Games.close_day(done)

      # someone else's game isn't yours
      {other, _} = signed_in()
      create(other, %{"bots" => ["bot"]})

      assert %{"games" => games} = conn |> get(~p"/api/games") |> json_response(200)
      assert Enum.map(games, & &1["id"]) == [waiting, sent, done]

      assert [
               %{"yours" => [^me, "raj"], "waiting_on_you" => [^me, "raj"], "released" => false},
               %{"day" => 2, "waiting_on_you" => [^me, "kim"]},
               %{
                 "released" => true,
                 "waiting_on_you" => [],
                 "deadline" => nil,
                 "scores" => %{"bot" => _}
               }
             ] = games
    end

    test "needs a signed-in device" do
      assert build_conn() |> get(~p"/api/games") |> json_response(401)
    end
  end

  describe "a hint (M15k)" do
    test "is the pack the bot's policy would write for your seat, from what that seat sees; ?seat= picks it",
         %{conn: conn, me: me} do
      %{"id" => id, "version" => version} = create(conn)

      for seat <- [me, "raj"] do
        view = conn |> get(~p"/api/games/#{id}?seat=#{seat}") |> json_response(200)
        assert %{"ops" => [_ | _] = ops} = hint(conn, id, %{"seat" => seat}) |> json_response(200)
        only_seen(ops, view)
        assert {:ok, _} = GitGame.Games.Pack.decode(%{"ops" => ops}, view["max_ops"])
        assert Enum.all?(ops, &(&1["why"] =~ ~r/\byour?\b|trap/))
      end

      # as with the view, a device holding several seats is answered for its first
      assert hint(conn, id) |> json_response(200) ==
               hint(conn, id, %{"seat" => me}) |> json_response(200)

      # only read: no pack was sent, and the game hasn't moved
      assert %{"version" => ^version, "sent_today" => []} =
               conn |> get(~p"/api/games/#{id}") |> json_response(200)
    end

    test "only for a seat you hold", %{conn: conn} do
      %{"id" => id} = create(conn)
      {stranger, _} = signed_in()

      assert %{"error" => "fatal: you hold no seat in this game"} =
               hint(stranger, id) |> json_response(403)

      assert %{"error" => "fatal: kim is not your seat"} =
               hint(conn, id, %{"seat" => "kim"}) |> json_response(403)

      assert %{"error" => "fatal: not signed in"} = hint(build_conn(), id) |> json_response(401)
      assert hint(conn, Ecto.UUID.generate()) |> json_response(404)
    end

    test "following the hints plays a game against the bot to the release, after which there are none",
         %{conn: conn} do
      %{"id" => id} = create(conn, %{"bots" => ["bot"], "seed" => 7})
      assert follow_hints(conn, id, 0)["released"]

      assert %{"error" => "fatal: v1.0 has shipped; the game is over"} =
               hint(conn, id) |> json_response(409)
    end
  end

  defp hint(conn, id, params \\ %{}), do: get(conn, ~p"/api/games/#{id}/hint", params)

  # A hint names only what its seat can see: cards in that seat's own hand, commits on main, traps it holds.
  defp only_seen(ops, view) do
    hand = view["you"]["hand"]
    main = Enum.map(view["main"], & &1["id"])

    for op <- ops do
      assert Enum.all?(Map.get(op, "cards", []), fn id -> Enum.any?(hand, &(&1["id"] == id)) end)
      assert Map.get(op, "target") in [nil | main]
      assert Map.get(op, "trap") in [nil | Enum.map(hand, & &1["command"])]
    end
  end

  defp follow_hints(conn, id, day) do
    view = conn |> get(~p"/api/games/#{id}") |> json_response(200)

    if view["released"] || day > 20 do
      view
    else
      %{"ops" => ops} = hint(conn, id) |> json_response(200)
      only_seen(ops, view)

      conn
      |> post(~p"/api/games/#{id}/packs", %{"version" => view["version"], "ops" => ops})
      |> json_response(202)

      follow_hints(conn, id, day + 1)
    end
  end

  # You ship your biggest card every day, the way a script calling the API would.
  defp play(conn, id, day) do
    view = conn |> get(~p"/api/games/#{id}") |> json_response(200)

    if view["released"] || day > 20 do
      view
    else
      card =
        view["you"]["hand"]
        |> Enum.filter(&(&1["kind"] == "commit"))
        |> Enum.max_by(& &1["lines"], fn -> nil end)

      build =
        if card, do: [%{"op" => "add", "cards" => [card["id"]]}, %{"op" => "commit"}], else: []

      ops = [%{"op" => "pull"}, %{"op" => "push"}] ++ build

      conn
      |> post(~p"/api/games/#{id}/packs", %{"version" => view["version"], "ops" => ops})
      |> json_response(202)

      play(conn, id, day + 1)
    end
  end
end
