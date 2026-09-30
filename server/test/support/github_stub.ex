defmodule GitGame.GitHubStub do
  @moduledoc """
  GitHub, for tests: an `Assent.HTTPAdapter` that answers the two requests linking makes. A code `"<login>-<id>"`
  becomes the GitHub user `<login>` with id `<id>`, so each test picks its account by the code it sends back, and tests
  can run at once. A token request without the PKCE verifier, or with the wrong secret, is refused as GitHub would.
  """
  @behaviour Assent.HTTPAdapter
  alias Assent.HTTPAdapter.HTTPResponse

  @impl true
  def request(method, url, body, headers, _opts \\ nil)

  def request(:post, "https://github.com/login/oauth/access_token", body, _headers, _opts) do
    params = URI.decode_query(body)

    if params["client_secret"] == "test-secret" and is_binary(params["code_verifier"]),
      do: json(200, %{access_token: "token:" <> params["code"], token_type: "bearer", scope: ""}),
      else: json(400, %{error: "bad_verification_code"})
  end

  def request(:get, "https://api.github.com/user", _body, headers, _opts) do
    {_, "Bearer token:" <> code} = List.keyfind(headers, "authorization", 0)
    [login, id] = String.split(code, "-", parts: 2)

    json(200, %{
      id: String.to_integer(id),
      login: login,
      avatar_url: "https://avatars.example/#{id}"
    })
  end

  defp json(status, body),
    do:
      {:ok,
       %HTTPResponse{
         status: status,
         headers: [{"content-type", "application/json"}],
         body: JSON.encode!(body)
       }}
end
