defmodule GitGameWeb.AuthController do
  @moduledoc """
  Linking GitHub (ADR-0005). `GET /api/auth/github` sends the browser to GitHub, keeping the flow's `state` and PKCE
  verifier in the signed session cookie; GitHub sends it back to the callback, which links the account
  (`GitGame.Players.link_github/2`), signs the device in as the player it belongs to, and returns to the client. These
  are page navigations, not API calls, so they answer with redirects.
  """
  use GitGameWeb, :controller
  require Logger
  alias GitGame.{GitHub, Players}
  alias GitGameWeb.Plugs.Identity

  action_fallback GitGameWeb.FallbackController

  def github(conn, _params) do
    if GitHub.enabled?() do
      {:ok, url, keep} = GitHub.authorize(callback_url())
      conn |> put_session(:github, keep) |> redirect(external: url)
    else
      {:error, :not_found, "fatal: GitHub sign-in isn't set up on this server"}
    end
  end

  def callback(conn, params) do
    kept = get_session(conn, :github)
    conn = delete_session(conn, :github)

    with %{} <- kept,
         {:ok, account} <- GitHub.callback(callback_url(), kept, params),
         {:ok, player} <- Players.link_github(conn.assigns.player, account) do
      # the device's old session goes: it may have been an anonymous player's, and the device is now someone else
      Players.sign_out(conn.assigns.session_token)
      {token, expires_at} = Players.sign_in(player)

      conn
      |> Identity.put(token, expires_at)
      |> redirect(external: GitGameWeb.public_url() <> "/")
    else
      failed ->
        # the reason's kind only: an error from GitHub can quote what it was sent
        Logger.info("GitHub link failed: #{inspect(kind(failed))}")
        redirect(conn, external: GitGameWeb.public_url() <> "/?github=failed")
    end
  end

  defp callback_url, do: GitGameWeb.public_url() <> "/api/auth/github/callback"

  defp kind({:error, %{__struct__: s}}), do: s
  defp kind({:error, reason}) when is_atom(reason), do: reason
  defp kind(nil), do: :no_flow_in_progress
  defp kind(_), do: :error
end
