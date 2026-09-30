defmodule GitGameWeb.RoomControllerTest do
  use GitGameWeb.ConnCase, async: true

  defp device do
    conn = post(build_conn(), ~p"/api/players")
    %{"player" => %{"handle" => handle}} = json_response(conn, 201)
    {conn, handle}
  end

  defp open(host), do: host |> post(~p"/api/rooms") |> json_response(201)

  test "a room by link: open, join, start, and both play the same game from their own seats" do
    {host, ana} = device()
    {guest, raj} = device()

    %{"code" => code} = room = open(host)
    assert %{"host" => ^ana, "members" => [%{"handle" => ^ana}], "game_id" => nil} = room
    assert room["you"] == %{"member" => true, "host" => true}
    assert code =~ ~r/^[2-9a-z]{8}$/

    # the guest opens the link: they see the room, and aren't in it until they join
    assert %{"you" => %{"member" => false}} =
             guest |> get(~p"/api/rooms/#{code}") |> json_response(200)

    assert %{"members" => [_, %{"handle" => ^raj}]} =
             guest |> post(~p"/api/rooms/#{code}/join") |> json_response(200)

    assert %{"game_id" => game} = host |> post(~p"/api/rooms/#{code}/start") |> json_response(200)

    for {device, me} <- [{host, ana}, {guest, raj}] do
      view = device |> get(~p"/api/games/#{game}") |> json_response(200)
      assert %{"seats" => [^ana, ^raj], "yours" => [^me], "you" => %{"player" => ^me}} = view

      assert device
             |> post(~p"/api/games/#{game}/packs", %{"version" => view["version"], "ops" => []})
             |> json_response(202)
    end

    # both packs in: the day closed
    assert %{"day" => 2} = guest |> get(~p"/api/games/#{game}") |> json_response(200)
  end

  test "the host sets bots and the day length; bots sit after the people" do
    {host, ana} = device()
    %{"code" => code} = open(host)

    assert %{"bots" => 2, "day_length" => "correspondence"} =
             host
             |> patch(~p"/api/rooms/#{code}", %{"bots" => 2, "day_length" => "correspondence"})
             |> json_response(200)

    %{"game_id" => game} = host |> post(~p"/api/rooms/#{code}/start") |> json_response(200)

    assert %{"seats" => [^ana, "bot-1", "bot-2"], "day_length" => "correspondence"} =
             host |> get(~p"/api/games/#{game}") |> json_response(200)
  end

  test "only the host sets up or starts the room, and a room needs two seats" do
    {host, _} = device()
    {guest, _} = device()
    %{"code" => code} = open(host)

    assert %{"error" => "fatal: a game needs at least 2 seats: invite someone, or add a bot"} =
             host |> post(~p"/api/rooms/#{code}/start") |> json_response(422)

    guest |> post(~p"/api/rooms/#{code}/join") |> json_response(200)

    assert %{"error" => "fatal: only the host starts the game"} =
             guest |> post(~p"/api/rooms/#{code}/start") |> json_response(403)

    assert guest |> patch(~p"/api/rooms/#{code}", %{"bots" => 1}) |> json_response(403)

    assert %{"error" => "day_length is one of " <> _} =
             host
             |> patch(~p"/api/rooms/#{code}", %{"day_length" => "fortnight"})
             |> json_response(422)
  end

  test "a room is full at five seats, and closed once started; joining twice changes nothing" do
    {host, _} = device()
    %{"code" => code} = open(host)
    host |> patch(~p"/api/rooms/#{code}", %{"bots" => 3}) |> json_response(200)

    {guest, _} = device()
    guest |> post(~p"/api/rooms/#{code}/join") |> json_response(200)

    assert %{"members" => [_, _]} =
             guest |> post(~p"/api/rooms/#{code}/join") |> json_response(200)

    {late, _} = device()

    assert %{"error" => "fatal: this room is full"} =
             late |> post(~p"/api/rooms/#{code}/join") |> json_response(409)

    assert host |> patch(~p"/api/rooms/#{code}", %{"bots" => 4}) |> json_response(422)

    host |> post(~p"/api/rooms/#{code}/start") |> json_response(200)
    host |> patch(~p"/api/rooms/#{code}", %{"bots" => 1}) |> json_response(409)

    assert %{"error" => "fatal: this room's game has started"} =
             host |> post(~p"/api/rooms/#{code}/start") |> json_response(409)
  end

  test "anyone can look at a room; joining needs a signed-in device; an unknown room is 404" do
    {host, _} = device()
    %{"code" => code} = open(host)

    assert %{"you" => %{"member" => false, "host" => false}} =
             build_conn() |> get(~p"/api/rooms/#{code}") |> json_response(200)

    assert build_conn() |> post(~p"/api/rooms/#{code}/join") |> json_response(401)

    assert %{"error" => "fatal: no room nope"} =
             build_conn() |> get(~p"/api/rooms/nope") |> json_response(404)

    assert build_conn() |> post(~p"/api/rooms") |> json_response(401)
  end

  test "the room's stream says refetch on connecting and on every change, and ends when the game starts" do
    {host, _} = device()
    %{"code" => code} = open(host)
    stream = Task.async(fn -> get(build_conn(), ~p"/api/rooms/#{code}/live") end)
    wait_until_watching(code)

    {guest, _} = device()
    guest |> post(~p"/api/rooms/#{code}/join") |> json_response(200)
    host |> post(~p"/api/rooms/#{code}/start") |> json_response(200)

    assert stream |> Task.await() |> response(200) ==
             String.duplicate("event: refetch\ndata: {\"over\":false}\n\n", 2) <>
               "event: refetch\ndata: {\"over\":true}\n\n"
  end

  defp wait_until_watching(code, tries \\ 100) do
    if Registry.lookup(GitGame.PubSub, "room:" <> code) == [] and tries > 0 do
      Process.sleep(5)
      wait_until_watching(code, tries - 1)
    end
  end
end
