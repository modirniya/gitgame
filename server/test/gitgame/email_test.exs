defmodule GitGame.EmailTest do
  use GitGame.DataCase, async: true
  import Swoosh.TestAssertions
  alias GitGame.{Email, Games, Players}
  alias GitGame.Notifications.{Digest, EmailChannel}

  defp player do
    {:ok, p} = Players.create_anonymous()
    p
  end

  # the token in the link an email carries
  defp token(email, path) do
    [_, token] = Regex.run(~r{/api/email/#{path}\?token=(\S+)}, email.text_body)
    token
  end

  defp confirmed(p, digest \\ false) do
    {:ok, _} = Email.set(p, "ana@example.com", digest)
    assert_email_sent(fn e -> send(self(), {:confirm, token(e, "confirm")}) end)
    assert_received {:confirm, t}
    {:ok, _} = Email.confirm(t)
  end

  test "an address is confirmed by the link sent to it before anything else is sent" do
    p = player()
    assert {:ok, %{confirmed_at: nil}} = Email.set(p, " ana@example.com ", false)

    assert_email_sent(fn email ->
      assert email.to == [{"", "ana@example.com"}]
      assert email.subject =~ "confirm your address"
      assert email.text_body =~ p.handle
      send(self(), {:token, token(email, "confirm")})
    end)

    refute EmailChannel.reaches?(p)
    assert_received {:token, t}
    assert {:ok, %{confirmed_at: %DateTime{}}} = Email.confirm(t)
    assert EmailChannel.reaches?(p)
  end

  test "a confirmation link is void once the address changes, forged, or for nothing" do
    p = player()
    {:ok, _} = Email.set(p, "ana@example.com", false)
    assert_email_sent(fn e -> send(self(), {:old, token(e, "confirm")}) end)
    {:ok, _} = Email.set(p, "ana@work.example", false)
    assert_received {:old, old}

    assert Email.confirm(old) == :error
    assert Email.confirm("forged") == :error
  end

  test "an address that isn't one is refused, and nothing is sent" do
    assert {:error, :invalid, "fatal: " <> _} = Email.set(player(), "ana at example", false)
    assert_no_email_sent()
  end

  test "a reminder links the game with its source, and says how to stop in body and headers (RFC 8058)" do
    p = player()
    confirmed(p)

    :ok =
      EmailChannel.deliver(p, %{
        title: "your pack is due",
        body: "day 2 of 7: send your pack",
        path: "/play#/g/abc"
      })

    assert_email_sent(fn email ->
      assert email.subject == "your pack is due"
      assert email.text_body =~ "/play?via=email#/g/abc"
      assert email.headers["List-Unsubscribe-Post"] == "List-Unsubscribe=One-Click"
      assert email.headers["List-Unsubscribe"] =~ "/api/email/unsubscribe?token="
      send(self(), {:unsubscribe, token(email, "unsubscribe")})
    end)

    assert_received {:unsubscribe, t}
    assert :ok = Email.unsubscribe(t)
    refute EmailChannel.reaches?(p)
    assert :ok = Email.unsubscribe(t)
  end

  test "a player who chose the digest gets no per-game email, and one digest a day listing what waits" do
    p = player()
    confirmed(p, true)
    refute EmailChannel.reaches?(p)

    {:ok, %{id: waiting}} =
      Games.create([p.handle, "bot"], bots: ["bot"], holders: %{p.handle => p.id})

    assert :ok = Digest.perform(%Oban.Job{})

    assert_email_sent(fn email ->
      assert email.subject == "1 game wait on your pack"
      assert email.text_body =~ "/play?via=digest#/g/#{waiting}"
    end)
  end

  test "the digest skips a player with nothing waiting" do
    confirmed(player(), true)
    assert :ok = Digest.perform(%Oban.Job{})
    assert_no_email_sent()
  end
end
