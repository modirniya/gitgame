defmodule GitGameWeb.StatsControllerTest do
  # the token is the application's environment, which every test shares
  use GitGameWeb.ConnCase, async: false

  defp with_token(token) do
    Application.put_env(:gitgame, :stats_token, token)
    on_exit(fn -> Application.delete_env(:gitgame, :stats_token) end)
  end

  defp basic(conn, password),
    do: put_req_header(conn, "authorization", Plug.BasicAuth.encode_basic_auth("me", password))

  test "without a token set, the stats aren't there at all", %{conn: conn} do
    assert conn |> get(~p"/api/stats") |> json_response(404)
    assert conn |> basic("anything") |> get(~p"/stats") |> json_response(404)
  end

  test "with a token set, they answer only to it", %{conn: conn} do
    with_token("a-shared-secret")

    for c <- [conn, basic(conn, "a wrong one")] do
      refused = get(c, ~p"/api/stats")
      assert refused.status == 401
      assert get_resp_header(refused, "www-authenticate") == [~s(Basic realm="stats")]
    end

    assert get(conn, ~p"/stats").status == 401
    page = conn |> basic("a-shared-secret") |> get(~p"/stats")
    assert html_response(page, 200) =~ ~s(<main id="stats">)
    assert [_csp] = get_resp_header(page, "content-security-policy")

    body = conn |> basic("a-shared-secret") |> get(~p"/api/stats") |> json_response(200)
    assert length(body["days"]) == 365
    assert Map.keys(body["totals"]) |> Enum.sort() == ~w(games packs players)
    assert body["pulse"]["in_progress"] == 0
    assert %{"since" => nil, "left_out" => 0} = body
  end
end
