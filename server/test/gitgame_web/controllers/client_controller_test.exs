defmodule GitGameWeb.ClientControllerTest do
  use GitGameWeb.ConnCase, async: true

  test "/ is the client's page, from the API's own origin, with its security policy", %{
    conn: conn
  } do
    conn = get(conn, ~p"/")

    assert html_response(conn, 200) =~ ~s(<main id="app">)
    assert [csp] = get_resp_header(conn, "content-security-policy")
    assert csp =~ "default-src 'self'"
    assert csp =~ "frame-ancestors 'none'"
    refute csp =~ "script-src 'unsafe-inline'"
    assert get_resp_header(conn, "cache-control") == ["no-cache"]
    assert get_resp_header(conn, "x-content-type-options") == ["nosniff"]
  end
end
