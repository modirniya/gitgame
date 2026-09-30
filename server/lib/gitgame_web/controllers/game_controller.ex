defmodule GitGameWeb.GameController do
  @moduledoc """
  The games API (M4): create a game, fetch its view as it is or as it was when a day closed, send or replace a pack.
  Errors carry Git's words where Git has them; a stale pack is `409`, after which the client refetches (charter
  decision 10).

  Seats belong to players (ADR-0005). You see a game as the seat you hold, and write packs only for it. In a hotseat
  game you hold every seat of the people at your device, and `seat` says which one. Anyone else sees what the table
  sees: the public view.
  """
  use GitGameWeb, :controller
  alias GitGame.Games
  alias GitGame.Games.View

  action_fallback GitGameWeb.FallbackController

  plug :signed_in when action in [:index, :create, :send_pack]

  # Your games (M9c): the ones waiting on your pack first.
  def index(conn, _params), do: json(conn, %{games: Games.list_for(conn.assigns.player.id)})

  # {"hotseat": ["raj"], "bots": ["bot"], "day_length": "live", "seed": 42}: you take the first seat, under your
  # handle; the people named in `hotseat` sit at your device, and you hold their seats too.
  def create(conn, params) do
    me = conn.assigns.player
    people = [me.handle | List.wrap(params["hotseat"])]
    bots = List.wrap(params["bots"])

    opts =
      [
        day_length: Map.get(params, "day_length", "live"),
        bots: bots,
        holders: Map.new(people, &{&1, me.id})
      ] ++ if(is_integer(params["seed"]), do: [seed: params["seed"]], else: [])

    with :ok <- names(people ++ bots),
         {:ok, %{id: id}} <- Games.create(people ++ bots, opts),
         {:ok, state} <- Games.load(id) do
      conn |> put_status(:created) |> view(state, id, nil)
    end
  end

  def show(conn, %{"id" => id} = params) do
    with {:ok, id} <- uuid(id),
         {:ok, state} <- Games.load(id),
         do: view(conn, state, id, seat(params))
  end

  # A replay (M7): the game as it stood when `day` closed, day 0 being the game as created, folded from the log.
  def day(conn, %{"id" => id, "day" => day} = params) do
    with {:ok, id} <- uuid(id),
         {:ok, day} <- day_number(day),
         {:ok, state} <- Games.load(id, through_day: day),
         do: view(conn, state, id, seat(params))
  end

  def send_pack(conn, %{"id" => id, "version" => version} = params) when is_integer(version) do
    with {:ok, id} <- uuid(id),
         {:ok, held} <- Games.seats_held(id, conn.assigns.player.id),
         {:ok, seat} <- writing_as(held, seat(params)),
         {:ok, %{version: version}} <-
           Games.send_pack(id, seat, version, Map.take(params, ["ops", "discard"])) do
      conn |> put_status(:accepted) |> json(%{version: version})
    end
  end

  def send_pack(_conn, _),
    do:
      {:error, :invalid,
       "a pack is sent with \"version\" and \"ops\", and \"seat\" in a hotseat game"}

  # The view for this device: a seat it holds (the one asked for, or its first), with `yours` listing them all, or the
  # public view for a device that holds none.
  defp view(conn, state, id, wanted) do
    player = conn.assigns.player

    with {:ok, held} <- Games.seats_held(id, player && player.id) do
      cond do
        held == [] and wanted == nil -> json(conn, View.public(state, id))
        wanted == nil or wanted in held -> json(conn, yours(state, id, wanted || hd(held), held))
        true -> {:error, :not_a_player, "fatal: #{wanted} is not your seat"}
      end
    end
  end

  # a seat is named by a string; anything else in its place names none
  defp seat(%{"seat" => seat}) when is_binary(seat), do: seat
  defp seat(_params), do: nil

  defp yours(state, id, seat, held),
    do: state |> View.for_player(id, seat) |> Map.put(:yours, held)

  defp writing_as([], _), do: {:error, :not_a_player, "fatal: you hold no seat in this game"}
  defp writing_as([only], nil), do: {:ok, only}

  defp writing_as(_held, nil),
    do: {:error, :invalid, "a pack names its \"seat\": you hold several"}

  defp writing_as(held, seat) do
    if seat in held,
      do: {:ok, seat},
      else: {:error, :not_a_player, "fatal: #{seat} is not your seat"}
  end

  defp signed_in(%{assigns: %{player: nil}} = conn, _opts) do
    conn |> put_status(:unauthorized) |> json(%{error: "fatal: not signed in"}) |> halt()
  end

  defp signed_in(conn, _opts), do: conn

  defp names(names) do
    if Enum.all?(names, &(is_binary(&1) and &1 != "")),
      do: :ok,
      else: {:error, :invalid, "every seat is named by a string"}
  end

  defp day_number(day) do
    case Integer.parse(day) do
      {n, ""} when n >= 0 -> {:ok, n}
      _ -> {:error, :not_found, "fatal: no day #{day}"}
    end
  end

  defp uuid(id) do
    case Ecto.UUID.cast(id) do
      {:ok, id} -> {:ok, id}
      :error -> {:error, :not_found, "fatal: no game #{id}"}
    end
  end
end
