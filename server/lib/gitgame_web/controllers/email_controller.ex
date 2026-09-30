defmodule GitGameWeb.EmailController do
  @moduledoc """
  Reminders by email for the client (ADR-0006): the address this player gave, set or removed; and the two links
  emails carry, to confirm an address and to unsubscribe, which are page navigations (and, for unsubscribing, a
  mail client's one-click POST, RFC 8058), answered with a redirect back to the client.
  """
  use GitGameWeb, :controller
  alias GitGame.Email

  action_fallback GitGameWeb.FallbackController

  plug :signed_in when action in [:show, :update, :delete]
  plug GitGameWeb.Plugs.RateLimit, [bucket: :emails, by: :player] when action == :update

  def show(conn, _params), do: json(conn, view(Email.get(conn.assigns.player)))

  def update(conn, params) do
    with {:ok, a} <-
           Email.set(conn.assigns.player, params["address"], Map.get(params, "digest", false)),
         do: json(conn, view(a))
  end

  def delete(conn, _params) do
    Email.remove(conn.assigns.player)
    send_resp(conn, :no_content, "")
  end

  def confirm(conn, params) do
    case Email.confirm(params["token"] || "") do
      {:ok, _} -> back(conn, "confirmed")
      :error -> back(conn, "failed")
    end
  end

  def unsubscribe(conn, params) do
    case Email.unsubscribe(params["token"] || "") do
      :ok ->
        if conn.method == "POST", do: send_resp(conn, :ok, ""), else: back(conn, "unsubscribed")

      :error ->
        back(conn, "failed")
    end
  end

  defp back(conn, what),
    do: redirect(conn, external: GitGameWeb.public_url() <> "/?email=" <> what)

  defp view(nil), do: %{email: nil, available: Email.enabled?()}

  defp view(a),
    do: %{
      email: %{address: a.address, confirmed: a.confirmed_at != nil, digest: a.digest},
      available: Email.enabled?()
    }

  defp signed_in(%{assigns: %{player: nil}} = conn, _opts) do
    conn |> put_status(:unauthorized) |> json(%{error: "fatal: not signed in"}) |> halt()
  end

  defp signed_in(conn, _opts), do: conn
end
