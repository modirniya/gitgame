defmodule GitGame.Players do
  @moduledoc """
  Players and their sessions (ADR-0005). Everyone starts anonymous, with a generated handle and a session, in one
  request, so nothing stands between a new visitor and a game (charter priority 2). Linking GitHub comes later (M8c).

  A session token is 32 random bytes, given to the device once and stored here only as its SHA-256. It lasts a year
  for an anonymous player, whose account is lost with the cookie, and 60 days once linked; either way it is extended
  when used, at most once a day, so an active player never gets signed out.
  """
  import Ecto.Query
  alias GitGame.Repo
  alias GitGame.Players.{Player, Session}

  @anonymous_days 365
  @linked_days 60

  @adjectives ~w(quiet brave tidy swift sleepy lucky clever gentle bold calm eager fuzzy jolly keen merry nimble
                 plucky rapid shy witty)
  @animals ~w(otter heron badger lynx gecko panda tapir koala marten ibis moose finch yak newt crane stoat
              wombat lemur puffin okapi)

  @doc "A new anonymous player, with a handle nobody else has."
  def create_anonymous(tries \\ 5) do
    %Player{}
    |> Ecto.Changeset.change(handle: handle())
    |> Ecto.Changeset.unique_constraint(:handle)
    |> Repo.insert()
    |> case do
      {:ok, player} -> {:ok, player}
      {:error, _taken} when tries > 1 -> create_anonymous(tries - 1)
      {:error, _taken} -> {:error, :invalid, "fatal: could not find a free handle; try again"}
    end
  end

  defp handle,
    do: "#{Enum.random(@adjectives)}-#{Enum.random(@animals)}-#{Enum.random(10..99)}"

  @doc "Signs a device in as `player`: returns the token for its cookie, and when it expires."
  def sign_in(%Player{} = player) do
    token = :crypto.strong_rand_bytes(32)
    expires_at = expiry(player)
    Repo.insert!(%Session{token_hash: hash(token), player_id: player.id, expires_at: expires_at})
    {Base.url_encode64(token, padding: false), expires_at}
  end

  @doc """
  The player a cookie's token signs in, or nil for a token that is malformed, unknown or expired. A session in use is
  extended, and the new expiry is returned with the player, for the cookie.
  """
  def from_token(token) when is_binary(token) do
    with {:ok, raw} <- Base.url_decode64(token, padding: false),
         %Session{} = session <- live_session(hash(raw)) do
      {session.player, extend(session)}
    else
      _ -> nil
    end
  end

  def from_token(_), do: nil

  defp live_session(token_hash) do
    now = DateTime.utc_now()

    Repo.one(
      from s in Session,
        where: s.token_hash == ^token_hash and s.expires_at > ^now,
        preload: :player
    )
  end

  defp extend(session) do
    renewed = expiry(session.player)

    if DateTime.diff(renewed, session.expires_at, :day) >= 1 do
      Repo.update_all(from(s in Session, where: s.id == ^session.id), set: [expires_at: renewed])
      renewed
    else
      session.expires_at
    end
  end

  @doc "Signs a device out: its session is deleted, so its cookie signs nobody in."
  def sign_out(token) when is_binary(token) do
    with {:ok, raw} <- Base.url_decode64(token, padding: false) do
      Repo.delete_all(from s in Session, where: s.token_hash == ^hash(raw))
    end

    :ok
  end

  def sign_out(_), do: :ok

  defp expiry(%Player{github_id: nil}),
    do: DateTime.add(DateTime.utc_now(), @anonymous_days, :day)

  defp expiry(%Player{}), do: DateTime.add(DateTime.utc_now(), @linked_days, :day)

  defp hash(raw), do: :crypto.hash(:sha256, raw)
end
