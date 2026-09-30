defmodule GitGameWeb.Plugs.RateLimitTest do
  use GitGameWeb.ConnCase, async: true
  alias GitGameWeb.Plugs.RateLimit

  # each test its own address, so tests running at once never share a count
  defp from(ip), do: %{build_conn(:post, "/api/players") | remote_ip: ip}

  test "an address gets its limit, then 429 with when to try again" do
    opts = RateLimit.init(bucket: :players, by: :ip, limit: 2)
    ip = {10, 0, 0, System.unique_integer([:positive]) |> rem(250)}

    refute RateLimit.call(from(ip), opts).halted
    refute RateLimit.call(from(ip), opts).halted

    conn = RateLimit.call(from(ip), opts)
    assert conn.halted
    assert conn.status == 429
    assert %{"error" => "fatal: too many requests" <> _} = JSON.decode!(conn.resp_body)
    assert [seconds] = get_resp_header(conn, "retry-after")
    assert String.to_integer(seconds) in 1..3600

    # another address, or another bucket, has its own count
    refute RateLimit.call(from({10, 0, 1, 1}), opts).halted
    refute RateLimit.call(from(ip), RateLimit.init(bucket: :other, by: :ip, limit: 2)).halted
  end

  test "a player's count is theirs, and a device signed in as nobody isn't counted by player" do
    opts = RateLimit.init(bucket: :games, by: :player, limit: 1)
    me = %{id: Ecto.UUID.generate()}

    refute RateLimit.call(assign(build_conn(), :player, me), opts).halted
    assert RateLimit.call(assign(build_conn(), :player, me), opts).halted
    refute RateLimit.call(assign(build_conn(), :player, %{id: Ecto.UUID.generate()}), opts).halted
    refute RateLimit.call(assign(build_conn(), :player, nil), opts).halted
  end
end
