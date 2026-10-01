defmodule GitGameWeb.ClientControllerTest do
  use GitGameWeb.ConnCase, async: true

  test "/ is the landing page and /play the game, from the API's own origin, each with its security policy",
       %{
         conn: conn
       } do
    landing = get(conn, ~p"/")
    assert html_response(landing, 200) =~ "<h1>"
    game = get(conn, ~p"/play")
    assert html_response(game, 200) =~ ~s(<main id="app">)
    assert html_response(get(conn, "/play/"), 200) =~ ~s(<main id="app">)

    for page <- [landing, game] do
      assert [csp] = get_resp_header(page, "content-security-policy")
      assert csp =~ "default-src 'self'"
      assert csp =~ "frame-ancestors 'none'"
      refute csp =~ "script-src 'unsafe-inline'"
      assert get_resp_header(page, "cache-control") == ["no-cache"]
      assert get_resp_header(page, "x-content-type-options") == ["nosniff"]
    end
  end

  test "links from before the game moved, whose query the server sees, go on to /play with it", %{
    conn: conn
  } do
    for query <- ["via=notification", "via=email", "email=confirmed", "github=failed"] do
      assert redirected_to(get(conn, "/?" <> query)) == "/play?" <> query
    end

    # a campaign's query is the landing page's own
    assert html_response(get(conn, "/?utm_source=hn"), 200) =~ "<h1>"
  end
end
