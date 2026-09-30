defmodule GitGame.Push do
  @moduledoc """
  Web Push (RFC 8030) with VAPID (RFC 8292), per ADR-0006: a push with no payload, which needs no message encryption,
  sent to each browser that subscribed. The service worker it wakes fetches the player's games and shows what waits.

  A push is signed with the deployment's VAPID key: a JWT (ES256) naming the push service as its audience, with the
  public key beside it, so the push service knows who is sending. Endpoints are only ever those of browsers' own push
  services: the server sends a request to whatever address a subscription names, and must never be made to send one
  anywhere else.

  The keys are `config :gitgame, :push` (`public_key`, `private_key`, base64url, and `subject`, a `mailto:`), from
  `GITGAME_VAPID_*` in the environment; `mix gitgame.vapid_keys` makes a pair. Without them, push is off.
  """
  import Ecto.Query
  require Logger
  alias GitGame.Repo
  alias GitGame.Players.Player
  alias GitGame.Push.Subscription

  # The push services browsers use: Chrome's (FCM), Firefox's, Safari's, Edge's.
  @services ~w(fcm.googleapis.com updates.push.services.mozilla.com push.services.mozilla.com web.push.apple.com
               notify.windows.com)

  def enabled?, do: Application.get_env(:gitgame, :push) != nil

  @doc "The public key a browser subscribes with (`applicationServerKey`), or nil when push is off."
  def public_key, do: enabled?() && Keyword.fetch!(config(), :public_key)

  @doc "Keeps a browser's subscription for `player`. A browser already subscribed for someone else is theirs now."
  def subscribe(%Player{} = player, %{"endpoint" => endpoint} = params)
      when is_binary(endpoint) do
    if allowed?(endpoint) do
      keys = Map.get(params, "keys", %{})

      Repo.insert!(
        %Subscription{
          player_id: player.id,
          endpoint: endpoint,
          p256dh: keys["p256dh"],
          auth: keys["auth"]
        },
        on_conflict: {:replace, [:player_id, :p256dh, :auth, :updated_at]},
        conflict_target: :endpoint
      )

      :ok
    else
      {:error, :invalid,
       "fatal: #{URI.parse(endpoint).host || "that"} isn't a browser's push service"}
    end
  end

  def subscribe(_player, _params),
    do: {:error, :invalid, "a subscription is sent with its \"endpoint\""}

  @doc "Forgets a browser's subscription, when it unsubscribes."
  def unsubscribe(%Player{} = player, endpoint) when is_binary(endpoint) do
    Repo.delete_all(
      from s in Subscription, where: s.endpoint == ^endpoint and s.player_id == ^player.id
    )

    :ok
  end

  def subscribed?(%Player{id: id}),
    do: Repo.exists?(from s in Subscription, where: s.player_id == ^id)

  @doc "Wakes every browser `player` subscribed. A subscription its push service says is gone is forgotten."
  def wake(%Player{id: id}) do
    for s <- Repo.all(from s in Subscription, where: s.player_id == ^id), do: send_one(s)
    :ok
  end

  defp send_one(%Subscription{endpoint: endpoint} = s) do
    headers = [
      {"ttl", "86400"},
      {"urgency", "normal"},
      {"authorization", "vapid t=#{jwt(endpoint)}, k=#{Keyword.fetch!(config(), :public_key)}"}
    ]

    case http().request(:post, endpoint, "", headers) do
      {:ok, %{status: status}} when status in 200..299 ->
        :ok

      {:ok, %{status: status}} when status in [404, 410] ->
        Repo.delete!(s)

      {:ok, %{status: status}} ->
        Logger.warning("push refused: #{status} from #{URI.parse(endpoint).host}")

      {:error, reason} ->
        Logger.warning("push failed: #{inspect(reason)}")
    end
  end

  defp allowed?(endpoint) do
    case URI.parse(endpoint) do
      %URI{scheme: "https", host: host} when is_binary(host) ->
        Enum.any?(@services, &(host == &1 or String.ends_with?(host, "." <> &1)))

      _ ->
        false
    end
  end

  @doc false
  # The VAPID JWT for a push to `endpoint`: ES256 over its push service's origin, for twelve hours.
  def jwt(endpoint) do
    uri = URI.parse(endpoint)
    header = b64(JSON.encode!(%{typ: "JWT", alg: "ES256"}))

    claims =
      b64(
        JSON.encode!(%{
          aud: "#{uri.scheme}://#{uri.host}",
          exp: System.system_time(:second) + 12 * 3600,
          sub: Keyword.fetch!(config(), :subject)
        })
      )

    input = header <> "." <> claims
    {:ok, private} = Base.url_decode64(Keyword.fetch!(config(), :private_key), padding: false)
    der = :crypto.sign(:ecdsa, :sha256, input, [private, :prime256v1])
    # JOSE wants the signature as r and s, 32 bytes each, not the DER that :crypto gives
    {:"ECDSA-Sig-Value", r, s} = :public_key.der_decode(:"ECDSA-Sig-Value", der)
    input <> "." <> b64(<<r::unsigned-big-size(256), s::unsigned-big-size(256)>>)
  end

  @doc "A new VAPID key pair, base64url: `{public, private}`."
  def generate_keys do
    {public, private} = :crypto.generate_key(:ecdh, :prime256v1)
    {b64(public), b64(private)}
  end

  defp b64(data), do: Base.url_encode64(data, padding: false)
  defp config, do: Application.fetch_env!(:gitgame, :push)
  defp http, do: Keyword.get(config(), :http, GitGame.HTTP)
end
