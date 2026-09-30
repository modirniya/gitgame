defmodule GitGame.GitHub do
  @moduledoc """
  Linking a GitHub account (ADR-0005): the web-application flow, with `state` and PKCE, asking for **no scopes**, so all
  we can learn is the public profile. The access token GitHub hands back is used once, to read that profile, and
  dropped; we never act on anyone's behalf.

  Assent's generic OAuth2 strategy does the protocol. Its GitHub strategy isn't used because it always reads
  `/user/emails`, which needs the `user:email` scope we don't ask for.

  Configured by `config :gitgame, :github, client_id: ..., client_secret: ...`, which `config/runtime.exs` reads from
  `GITGAME_GITHUB_CLIENT_ID` and `GITGAME_GITHUB_CLIENT_SECRET`. Without them, linking is off and anonymous play is all
  there is.
  """
  alias Assent.Strategy.OAuth2

  def enabled?, do: Application.get_env(:gitgame, :github) != nil

  @doc "Where to send the browser, and what to keep in its session cookie until it comes back: `{:ok, url, keep}`."
  def authorize(redirect_uri) do
    with {:ok, %{url: url, session_params: keep}} <- OAuth2.authorize_url(config(redirect_uri)),
         do: {:ok, url, keep}
  end

  @doc """
  The GitHub account that came back: `{:ok, %{id, login, avatar_url}}`, or `{:error, reason}` for a flow that was
  refused, forged (`state` doesn't match) or failed.
  """
  def callback(redirect_uri, kept, params) do
    config = config(redirect_uri) |> Keyword.put(:session_params, kept)

    case OAuth2.callback(config, params) do
      {:ok, %{user: %{"id" => id, "login" => login} = user}} when is_integer(id) ->
        {:ok, %{id: id, login: login, avatar_url: user["avatar_url"]}}

      {:ok, _unexpected} ->
        {:error, :unexpected_user}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp config(redirect_uri) do
    github = Application.fetch_env!(:gitgame, :github)

    [
      client_id: Keyword.fetch!(github, :client_id),
      client_secret: Keyword.fetch!(github, :client_secret),
      auth_method: :client_secret_post,
      base_url: "https://api.github.com",
      authorize_url: "https://github.com/login/oauth/authorize",
      token_url: "https://github.com/login/oauth/access_token",
      user_url: "/user",
      redirect_uri: redirect_uri,
      code_verifier: true,
      http_adapter: Keyword.get(github, :http_adapter, GitGame.GitHub.HTTP)
    ]
  end
end
