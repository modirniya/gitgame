defmodule GitGameWeb.EmailControllerTest do
  use GitGameWeb.ConnCase, async: true
  import Swoosh.TestAssertions

  defp signed_in, do: post(build_conn(), ~p"/api/players")

  defp link_token(path) do
    assert_email_sent(fn e ->
      send(self(), {:t, Regex.run(~r{/api/email/#{path}\?token=(\S+)}, e.text_body)})
    end)

    assert_received {:t, [_, token]}
    token
  end

  test "a player sets, reads and removes their address; the confirm link comes back to the client" do
    conn = signed_in()

    assert %{"email" => nil, "available" => true} =
             conn |> get(~p"/api/email") |> json_response(200)

    assert %{"email" => %{"address" => "ana@example.com", "confirmed" => false, "digest" => true}} =
             conn
             |> put(~p"/api/email", %{"address" => "ana@example.com", "digest" => true})
             |> json_response(200)

    token = link_token("confirm")
    confirmed = get(build_conn(), ~p"/api/email/confirm?token=#{token}")
    assert redirected_to(confirmed) == GitGameWeb.public_url() <> "/?email=confirmed"

    assert %{"email" => %{"confirmed" => true}} =
             conn |> get(~p"/api/email") |> json_response(200)

    assert conn |> delete(~p"/api/email") |> response(204)
    assert %{"email" => nil} = conn |> get(~p"/api/email") |> json_response(200)
  end

  test "an unsubscribe link works as a page and as a mail client's one-click POST" do
    conn = signed_in()
    put(conn, ~p"/api/email", %{"address" => "ana@example.com"})
    token = link_token("confirm")
    get(build_conn(), ~p"/api/email/confirm?token=#{token}")

    unsubscribe =
      Phoenix.Token.sign(
        GitGameWeb.Endpoint,
        "unsubscribe",
        GitGame.Repo.one!(GitGame.Email.Address).id
      )

    assert build_conn() |> post(~p"/api/email/unsubscribe?token=#{unsubscribe}") |> response(200)
    assert %{"email" => nil} = conn |> get(~p"/api/email") |> json_response(200)

    assert build_conn() |> get(~p"/api/email/unsubscribe?token=#{unsubscribe}") |> redirected_to() =~
             "email=unsubscribed"

    assert build_conn() |> get(~p"/api/email/confirm?token=nope") |> redirected_to() =~
             "email=failed"
  end

  test "a bad address is 422; a device signed in as nobody is 401" do
    assert signed_in() |> put(~p"/api/email", %{"address" => "nope"}) |> json_response(422)
    assert build_conn() |> put(~p"/api/email", %{"address" => "a@b.co"}) |> json_response(401)
  end
end
