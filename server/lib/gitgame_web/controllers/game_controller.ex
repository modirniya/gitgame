defmodule GitGameWeb.GameController do
  @moduledoc """
  The games API (M4): create a game, fetch its view as it is or as it was when a day closed, send or replace a pack.
  Errors carry Git's words where Git has them; a stale pack is `409`, after which the client refetches (charter
  decision 10).
  """
  use GitGameWeb, :controller
  alias GitGame.Games
  alias GitGame.Games.View

  action_fallback GitGameWeb.FallbackController

  def create(conn, %{"seats" => seats} = params) when is_list(seats) do
    opts =
      [day_length: Map.get(params, "day_length", "live"), bots: List.wrap(params["bots"])] ++
        if(is_integer(params["seed"]), do: [seed: params["seed"]], else: [])

    with {:ok, %{id: id}} <- Games.create(seats, opts), {:ok, state} <- Games.load(id) do
      conn |> put_status(:created) |> json(View.public(state, id))
    end
  end

  def create(_conn, _),
    do: {:error, :invalid, "a game is created with \"seats\": a list of 2 to 5 players"}

  # ?player=ana: ana's view, with her cards. Until sign-in (M8) the table trusts the name, as a hotseat game does.
  def show(conn, %{"id" => id} = params) do
    with {:ok, id} <- uuid(id),
         {:ok, state} <- Games.load(id),
         do: view(conn, state, id, params["player"])
  end

  # A replay (M7): the game as it stood when `day` closed, day 0 being the game as created, folded from the log.
  def day(conn, %{"id" => id, "day" => day} = params) do
    with {:ok, id} <- uuid(id),
         {:ok, day} <- day_number(day),
         {:ok, state} <- Games.load(id, through_day: day),
         do: view(conn, state, id, params["player"])
  end

  defp view(conn, state, id, nil), do: json(conn, View.public(state, id))

  defp view(conn, state, id, player) do
    if player in state.game.seats,
      do: json(conn, View.for_player(state, id, player)),
      else: {:error, :not_a_player, "fatal: #{player} is not in this game"}
  end

  def send_pack(conn, %{"id" => id, "player" => player, "version" => version} = params)
      when is_binary(player) and is_integer(version) do
    with {:ok, id} <- uuid(id),
         {:ok, %{version: version}} <-
           Games.send_pack(id, player, version, Map.take(params, ["ops", "discard"])) do
      conn |> put_status(:accepted) |> json(%{version: version})
    end
  end

  def send_pack(_conn, _),
    do: {:error, :invalid, "a pack is sent with \"player\", \"version\" and \"ops\""}

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
