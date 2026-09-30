defmodule GitGameWeb.AuthControllerTest do
  @moduledoc "Linking GitHub through the browser flow, against GitGame.GitHubStub: never the real GitHub."
  use GitGameWeb.ConnCase, async: true
  alias GitGame.Games

  defp device do
    conn = post(build_conn(), ~p"/api/players")
    %{"player" => me} = json_response(conn, 201)
    {conn, me}
  end

  # The browser's trip: to GitHub and back with `code`, carrying the session cookie that holds the flow's state.
  defp link(conn, code, state \\ nil) do
    conn = get(conn, ~p"/api/auth/github")

    %{"state" => sent} =
      conn |> redirected_to() |> URI.parse() |> Map.fetch!(:query) |> URI.decode_query()

    get(conn, ~p"/api/auth/github/callback?#{[code: code, state: state || sent]}")
  end

  defp me(conn), do: conn |> get(~p"/api/session") |> json_response(200)

  test "the flow sends the browser to GitHub with state and PKCE, asking for no scopes" do
    {conn, _} = device()
    url = conn |> get(~p"/api/auth/github") |> redirected_to() |> URI.parse()
    query = URI.decode_query(url.query)

    assert url.host == "github.com" and url.path == "/login/oauth/authorize"
    assert %{"client_id" => "test-client", "state" => _, "code_challenge" => _} = query
    assert query["code_challenge_method"] == "S256"
    assert query["redirect_uri"] == GitGameWeb.public_url() <> "/api/auth/github/callback"
    refute Map.has_key?(query, "scope")
  end

  test "a GitHub account we haven't seen is linked to this device's player, games and all" do
    {conn, me} = device()
    %{"id" => game} = conn |> post(~p"/api/games", %{"bots" => ["bot"]}) |> json_response(201)

    conn = link(conn, "octo-42")
    assert redirected_to(conn) == GitGameWeb.public_url() <> "/"

    assert %{"player" => %{"id" => id, "handle" => handle, "github" => github}} = me(conn)
    assert {id, handle} == {me["id"], me["handle"]}
    assert github == %{"login" => "octo", "avatar_url" => "https://avatars.example/42"}
    assert %{"yours" => [^handle]} = conn |> get(~p"/api/games/#{game}") |> json_response(200)

    # linked, the session is the 60-day kind
    assert %{max_age: max_age} = conn.resp_cookies["gitgame_session"]
    assert max_age in (59 * 24 * 3600)..(60 * 24 * 3600)
  end

  test "the same GitHub account on a second device signs it in as the same player, and brings its seats" do
    {first, me} = device()
    link(first, "octo-42")

    # the second device played anonymously before linking
    {second, anon} = device()
    %{"id" => game} = second |> post(~p"/api/games", %{"bots" => ["bot"]}) |> json_response(201)

    old = second.resp_cookies["gitgame_session"].value
    second = link(second, "octo-42")
    assert %{"player" => %{"id" => id}} = me(second)
    assert id == me["id"]
    assert %{"yours" => [seat]} = second |> get(~p"/api/games/#{game}") |> json_response(200)
    assert seat == anon["handle"]
    assert {:ok, [^seat]} = Games.seats_held(game, me["id"])

    # the anonymous player's old session no longer signs anyone in
    assert build_conn()
           |> put_req_cookie("gitgame_session", old)
           |> get(~p"/api/session")
           |> json_response(401)
  end

  test "a forged or refused trip back links nothing and signs no one in" do
    {conn, me} = device()

    forged = link(conn, "octo-42", "not-the-state")
    assert redirected_to(forged) == GitGameWeb.public_url() <> "/?github=failed"
    assert %{"player" => %{"github" => nil, "id" => id}} = me(forged)
    assert id == me["id"]

    # GitHub came back with an error instead of a code
    refused =
      conn |> get(~p"/api/auth/github") |> get(~p"/api/auth/github/callback?error=access_denied")

    assert redirected_to(refused) =~ "github=failed"

    # a callback with no flow started
    assert build_conn()
           |> get(~p"/api/auth/github/callback?code=octo-42&state=x")
           |> redirected_to() =~
             "github=failed"
  end

  test "the device learns whether this server can link GitHub" do
    {conn, _} = device()
    assert %{"link_github" => true} = me(conn)
  end
end
