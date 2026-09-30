defmodule GitGame.NotificationsDoneTest do
  @moduledoc """
  M10's done-when, through both real channels: a 24-hour day's reminder sends one push (to the stand-in push service)
  and one email (Swoosh's test adapter) to a player whose pack isn't in, none to one whose pack is, and none twice;
  and opening the game from it marks a visit that came from a notification.
  """
  use GitGameWeb.ConnCase, async: true
  import Swoosh.TestAssertions
  alias GitGame.{Email, Games, Notifications, Push}
  alias GitGame.Notifications.{EmailChannel, PushChannel}

  @channels [PushChannel, EmailChannel]

  defp device do
    conn = post(build_conn(), ~p"/api/players")
    %{"player" => %{"id" => id}} = json_response(conn, 201)
    {conn, GitGame.Repo.get!(GitGame.Players.Player, id)}
  end

  defp reachable(player, n) do
    Push.subscribe(player, %{"endpoint" => "https://fcm.googleapis.com/fcm/send/#{n}"})
    {:ok, _} = Email.set(player, "#{player.handle}@example.com", false)

    assert_email_sent(fn e ->
      send(self(), {:t, Regex.run(~r{confirm\?token=(\S+)}, e.text_body) |> List.last()})
    end)

    assert_received {:t, token}
    {:ok, _} = Email.confirm(token)
  end

  test "one push and one email to whoever owes a pack, none to whoever doesn't, none twice; the visit is counted" do
    {ana_conn, ana} = device()
    {_raj_conn, raj} = device()
    reachable(ana, 1)
    reachable(raj, 2)

    {:ok, %{id: id}} =
      Games.create([ana.handle, raj.handle],
        day_length: "correspondence",
        holders: %{ana.handle => ana.id, raj.handle => raj.id}
      )

    {:ok, _} = Games.send_pack(id, raj.handle, 1, %{"ops" => []})

    for _ <- 1..2, do: :ok = Notifications.send_now(id, 1, "pack_due", @channels)

    assert_received {:pushed, "https://fcm.googleapis.com/fcm/send/1", _}
    refute_received {:pushed, _, _}
    assert_email_sent(to: "#{ana.handle}@example.com", subject: "your pack is due")
    assert_no_email_sent()

    # the next day, ana opens the game from it: the client passes ?via= to the session call, and the beta counts it
    GitGame.Repo.delete_all(GitGame.Beta.Mark)
    ana_conn |> get(~p"/api/session?via=notification") |> json_response(200)
    assert [%{via: "notification"}] = GitGame.Repo.all(GitGame.Beta.Mark)
  end
end
