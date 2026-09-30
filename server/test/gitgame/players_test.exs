defmodule GitGame.PlayersTest do
  use GitGame.DataCase, async: true
  alias GitGame.Players
  alias GitGame.Players.{Player, Session}

  test "an anonymous player gets a generated handle nobody else has" do
    {:ok, a} = Players.create_anonymous()
    {:ok, b} = Players.create_anonymous()

    assert a.handle =~ ~r/^[a-z]+-[a-z]+-\d\d$/
    assert a.handle != b.handle
    assert a.github_id == nil
  end

  test "a session's token signs its player in; the database holds only its hash" do
    {:ok, player} = Players.create_anonymous()
    {token, _expires_at} = Players.sign_in(player)

    assert {%Player{id: id}, _} = Players.from_token(token)
    assert id == player.id

    [session] = Repo.all(Session)
    {:ok, raw} = Base.url_decode64(token, padding: false)
    assert byte_size(raw) == 32
    assert session.token_hash == :crypto.hash(:sha256, raw)
    refute session.token_hash == raw
  end

  test "an anonymous session lasts a year" do
    {:ok, player} = Players.create_anonymous()
    {_token, expires_at} = Players.sign_in(player)
    assert DateTime.diff(expires_at, DateTime.utc_now(), :day) in 364..365
  end

  test "a session in use is extended, at most once a day" do
    {:ok, player} = Players.create_anonymous()
    {token, _} = Players.sign_in(player)

    # as if the session were ten days old
    soon = DateTime.add(DateTime.utc_now(), 355, :day)
    Repo.update_all(Session, set: [expires_at: soon])
    {_, extended} = Players.from_token(token)
    assert DateTime.diff(extended, soon, :day) >= 9

    # used again the same day: nothing to write
    {_, again} = Players.from_token(token)
    assert again == extended
  end

  test "a token that is unknown, malformed, expired or signed out signs nobody in" do
    {:ok, player} = Players.create_anonymous()
    {token, _} = Players.sign_in(player)

    assert Players.from_token(Base.url_encode64(:crypto.strong_rand_bytes(32), padding: false)) ==
             nil

    assert Players.from_token("not base64!") == nil
    assert Players.from_token(nil) == nil

    Repo.update_all(Session, set: [expires_at: DateTime.add(DateTime.utc_now(), -1, :second)])
    assert Players.from_token(token) == nil

    {token, _} = Players.sign_in(player)
    :ok = Players.sign_out(token)
    assert Players.from_token(token) == nil
  end
end
