defmodule GitGameWeb.Plugs.ClientIPTest do
  # the header is read from application config, which this test changes: not alongside others
  use GitGameWeb.ConnCase, async: false
  alias GitGameWeb.Plugs.ClientIP

  setup do
    on_exit(fn -> Application.delete_env(:gitgame, :client_ip_header) end)
  end

  defp from(header, value), do: build_conn() |> put_req_header(header, value) |> ClientIP.call([])

  test "behind the host's proxy, the caller's address is the one its header names" do
    Application.put_env(:gitgame, :client_ip_header, "fly-client-ip")
    assert from("fly-client-ip", "203.0.113.7").remote_ip == {203, 0, 113, 7}
    assert from("fly-client-ip", "2001:db8::1").remote_ip == {8193, 3512, 0, 0, 0, 0, 0, 1}

    # nonsense leaves the proxy's own address in place
    assert from("fly-client-ip", "not an address").remote_ip == {127, 0, 0, 1}
  end

  test "anywhere else, a header naming an address is just a header a client sent" do
    assert from("fly-client-ip", "203.0.113.7").remote_ip == {127, 0, 0, 1}
  end
end
