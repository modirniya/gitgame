defmodule GitGameWeb.LiveControllerTest do
  use GitGameWeb.ConnCase, async: true
  alias GitGame.Games

  @refetch "event: refetch\ndata: {\"over\":false}\n\n"
  @last "event: refetch\ndata: {\"over\":true}\n\n"

  test "a finished game's stream says refetch once, that it is over, and ends", %{conn: conn} do
    {:ok, %{id: id}} = Games.create(["hal", "eve"], bots: ["hal", "eve"], seed: 7)
    conn = get(conn, ~p"/api/games/#{id}/live")

    assert response(conn, 200) == @last
    assert get_resp_header(conn, "content-type") == ["text/event-stream"]
  end

  test "a live game's stream says refetch on connecting and after every write, then ends at the release",
       %{conn: conn} do
    {:ok, %{id: id}} = Games.create(["ana", "raj"], seed: 42)
    stream = Task.async(fn -> get(conn, ~p"/api/games/#{id}/live") end)
    wait_until_watching(id)

    {:ok, _} = Games.send_pack(id, "ana", 1, %{"ops" => []})
    for _ <- 1..12, do: {:ok, _} = Games.close_day(id)

    body = stream |> Task.await() |> response(200)
    assert body == String.duplicate(@refetch, 1 + 1 + 11) <> @last
    refute body =~ "ana"
  end

  test "an unknown game is 404", %{conn: conn} do
    assert conn |> get(~p"/api/games/#{Ecto.UUID.generate()}/live") |> response(404)
    assert conn |> get(~p"/api/games/nope/live") |> response(404)
  end

  defp wait_until_watching(id, tries \\ 100) do
    if Registry.lookup(GitGame.PubSub, "game:" <> id) == [] and tries > 0 do
      Process.sleep(5)
      wait_until_watching(id, tries - 1)
    end
  end
end
