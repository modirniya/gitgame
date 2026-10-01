defmodule GitGame.Email do
  @moduledoc """
  Reminders by email (ADR-0006): an address a player gives for them, never one taken from GitHub (ADR-0005),
  confirmed by a link before anything else is sent to it, with a one-click unsubscribe in every email that follows
  (RFC 8058). The links carry signed tokens (`Phoenix.Token`), so nothing needs storing to check them; the one to
  confirm names the address too, so changing the address voids it.

  A player may choose the daily digest instead: one email a day listing the games that wait on them, rather than one
  per game (`GitGame.Notifications.Digest`).
  """
  import Ecto.Query
  import Swoosh.Email, except: [from: 2]
  alias GitGame.{Mailer, Repo}
  alias GitGame.Email.Address
  alias GitGame.Players.Player

  @confirm_for 2 * 24 * 3600

  def enabled?, do: Mailer.enabled?()

  @doc "The address `player` gave, or nil."
  def get(%Player{id: id}), do: Repo.get_by(Address, player_id: id)

  @doc """
  `player` gives `address` for reminders, as a digest or not: stored unconfirmed, and a confirmation sent to it. The
  same address again changes only the digest choice.
  """
  def set(%Player{} = player, address, digest) when is_binary(address) and is_boolean(digest) do
    address = String.trim(address)

    cond do
      not enabled?() ->
        {:error, :not_found, "fatal: reminders by email aren't set up on this server"}

      not valid?(address) ->
        {:error, :invalid, "fatal: #{inspect(address)} doesn't look like an email address"}

      true ->
        case get(player) do
          %Address{address: ^address} = same ->
            {:ok, same |> Ecto.Changeset.change(digest: digest) |> Repo.update!()}

          old ->
            if old, do: Repo.delete!(old)
            new = Repo.insert!(%Address{player_id: player.id, address: address, digest: digest})
            deliver(confirmation(player, new))
            {:ok, new}
        end
    end
  end

  def set(_player, _address, _digest),
    do: {:error, :invalid, "an address is sent as \"address\", with \"digest\" true or false"}

  @doc "Forgets `player`'s address."
  def remove(%Player{id: id}) do
    Repo.delete_all(from a in Address, where: a.player_id == ^id)
    :ok
  end

  @doc "A confirmation link's token: the address confirmed, or `:error` for one expired, forged or for another address."
  def confirm(token) do
    with {:ok, {id, address}} <-
           Phoenix.Token.verify(GitGameWeb.Endpoint, "confirm", token, max_age: @confirm_for),
         %Address{address: ^address} = a <- Repo.get(Address, id) do
      {:ok,
       a
       |> Ecto.Changeset.change(confirmed_at: a.confirmed_at || DateTime.utc_now())
       |> Repo.update!()}
    else
      _ -> :error
    end
  end

  @doc "An unsubscribe link's token: the address forgotten. Unsubscribing twice is not an error."
  def unsubscribe(token) do
    case Phoenix.Token.verify(GitGameWeb.Endpoint, "unsubscribe", token, max_age: :infinity) do
      {:ok, id} ->
        Repo.delete_all(from a in Address, where: a.id == ^id)
        :ok

      _ ->
        :error
    end
  end

  @doc "Whether reminders go to this player by email, one per game."
  def reaches?(%Player{} = player),
    do: enabled?() and match?(%Address{confirmed_at: %DateTime{}, digest: false}, get(player))

  @doc "A reminder, to a confirmed address. `message` is a `GitGame.Notifications.Channel.message()`."
  def remind(%Player{} = player, message) do
    a = get(player)

    email(a, message.title, """
    #{message.body}.

    Open the game: #{link(message.path, "email")}
    """)
    |> deliver()
  end

  @doc "The digest: one email listing `games` (as `GitGame.Games.list_for/1` gives them), all waiting on `player`."
  def digest(%Player{} = player, games) do
    a = get(player)
    n = length(games)

    lines =
      Enum.map_join(games, "\n", fn g ->
        "  - day #{g.day} of #{g.final_day}, vs #{Enum.join(g.seats -- g.yours, ", ")}: #{link("/play#/g/#{g.id}", "digest")}"
      end)

    email(a, "#{n} game#{if n == 1, do: "", else: "s"} wait on your pack", """
    Your pack is due in:

    #{lines}
    """)
    |> deliver()
  end

  defp confirmation(player, a) do
    token = Phoenix.Token.sign(GitGameWeb.Endpoint, "confirm", {a.id, a.address})

    new()
    |> to(a.address)
    |> Swoosh.Email.from(Mailer.from())
    |> subject("confirm your address for #{GitGame.Brand.name()} reminders")
    |> text_body("""
    Someone playing #{GitGame.Brand.name()} as #{player.handle} asked for reminders at this address.

    To have them, confirm it: #{GitGameWeb.public_url()}/api/email/confirm?token=#{token}

    If that wasn't you, ignore this email: nothing more will be sent.
    """)
  end

  # every email after the confirmation says how to stop them, in its body and in the headers mail clients use
  defp email(a, subject, body) do
    unsubscribe =
      "#{GitGameWeb.public_url()}/api/email/unsubscribe?token=" <>
        Phoenix.Token.sign(GitGameWeb.Endpoint, "unsubscribe", a.id)

    new()
    |> to(a.address)
    |> Swoosh.Email.from(Mailer.from())
    |> subject(subject)
    |> header("List-Unsubscribe", "<#{unsubscribe}>")
    |> header("List-Unsubscribe-Post", "List-Unsubscribe=One-Click")
    |> text_body(body <> "\nNo more emails: #{unsubscribe}\n")
  end

  # where the email came from goes in the query, before the client's `#/…`
  defp link(path, via) do
    [page, hash] = String.split(path, "#", parts: 2)
    "#{GitGameWeb.public_url()}#{page}?via=#{via}##{hash}"
  end

  defp deliver(email) do
    {:ok, _} = Mailer.deliver(email)
    :ok
  end

  # enough to catch a typo; the confirmation link is what proves an address
  defp valid?(address),
    do: byte_size(address) <= 254 and address =~ ~r/^[^\s@]+@[^\s@]+\.[^\s@]+$/
end
