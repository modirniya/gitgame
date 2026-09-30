defmodule GitGameWeb.PushControllerTest do
  use GitGameWeb.ConnCase, async: true

  @fcm "https://fcm.googleapis.com/fcm/send/abc123"

  test "the key to subscribe with; a subscription kept and dropped by a signed-in device" do
    assert %{"public_key" => key} = build_conn() |> get(~p"/api/push") |> json_response(200)
    assert key == GitGame.Push.public_key()

    body = %{"endpoint" => @fcm, "keys" => %{"p256dh" => "x", "auth" => "y"}}
    assert build_conn() |> post(~p"/api/push/subscriptions", body) |> json_response(401)

    conn = post(build_conn(), ~p"/api/players")
    assert conn |> post(~p"/api/push/subscriptions", body) |> response(204)

    assert %{"error" => "fatal: localhost isn't a browser's push service"} =
             conn
             |> post(~p"/api/push/subscriptions", %{"endpoint" => "https://localhost/x"})
             |> json_response(422)

    assert conn |> delete(~p"/api/push/subscriptions", %{"endpoint" => @fcm}) |> response(204)
    assert GitGame.Repo.aggregate(GitGame.Push.Subscription, :count) == 0
  end

  test "a game's view says whether its days are long enough to be reminded of" do
    conn = post(build_conn(), ~p"/api/players")

    for {length, reminders} <- [{"correspondence", true}, {"lunch", false}, {"live", false}] do
      game =
        conn
        |> post(~p"/api/games", %{"bots" => ["bot"], "day_length" => length})
        |> json_response(201)

      assert game["reminders"] == reminders
    end
  end
end
