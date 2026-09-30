defmodule GitGame.Rooms do
  @moduledoc """
  Rooms (M9): where a private game is gathered before it starts. A game's seats are fixed when it is made, because its
  log names them (ADR-0004), so people join a room by its link, and its host starts the game when they're all in:
  every member takes a seat under their handle, in the order they joined, then the bots.

  A room holds five seats, members and bots together, and closes once its game has started. Every change is signalled
  on `{:room, code}` (`GitGame.Signal`), after it commits, so everyone looking at the room fetches it again.
  """
  import Ecto.Query
  alias GitGame.{Games, Repo, Rules, Signal}
  alias GitGame.Players.Player
  alias GitGame.Rooms.{Member, Room}

  @seats 5
  # no 0/o, 1/l/i: a code is read aloud and typed by hand
  @alphabet ~c"23456789abcdefghjkmnpqrstuvwxyz"

  @doc "A new room hosted by `host`, who is its first member. `{:ok, room}`."
  def open(%Player{} = host, tries \\ 5) do
    Repo.transaction(fn ->
      room =
        %Room{}
        |> Ecto.Changeset.change(code: code(), host_id: host.id, day_length: "live", bots: 0)
        |> Ecto.Changeset.unique_constraint(:code)
        |> Repo.insert()

      case room do
        {:ok, room} ->
          Repo.insert!(%Member{
            room_id: room.id,
            player_id: host.id,
            joined_at: DateTime.utc_now()
          })

          room.code

        {:error, _taken} ->
          Repo.rollback(:taken)
      end
    end)
    |> case do
      {:ok, code} -> get(code)
      {:error, :taken} when tries > 1 -> open(host, tries - 1)
      {:error, :taken} -> {:error, :invalid, "fatal: could not find a free room code; try again"}
    end
  end

  defp code, do: for(_ <- 1..8, into: "", do: <<Enum.random(@alphabet)>>)

  @doc "The room with `code`, its host and its members in the order they joined, or `{:error, :not_found}`."
  def get(code) when is_binary(code) do
    case Repo.one(from r in Room, where: r.code == ^code, preload: [:host, members: :player]) do
      nil -> {:error, :not_found}
      room -> {:ok, room}
    end
  end

  @doc "`player` joins the room. Joining a room you're in already changes nothing."
  def join(code, %Player{} = player) do
    locked(code, fn room ->
      cond do
        member?(room, player) ->
          {:ok, :already}

        room.game_id ->
          {:error, :over, "fatal: this room's game has started"}

        length(room.members) + room.bots >= @seats ->
          {:error, :over, "fatal: this room is full"}

        true ->
          {:ok,
           Repo.insert!(%Member{
             room_id: room.id,
             player_id: player.id,
             joined_at: DateTime.utc_now()
           })}
      end
    end)
  end

  @doc "The host sets the bots (`\"bots\"`) and the day length (`\"day_length\"`) before the game starts."
  def update(code, %Player{} = player, attrs) do
    locked(code, fn room ->
      bots = Map.get(attrs, "bots", room.bots)
      day_length = Map.get(attrs, "day_length", room.day_length)

      cond do
        room.host_id != player.id ->
          {:error, :not_a_player, "fatal: only the host sets up the room"}

        room.game_id ->
          {:error, :over, "fatal: this room's game has started"}

        not (is_integer(bots) and bots >= 0) ->
          {:error, :invalid, "bots is a number"}

        length(room.members) + bots > @seats ->
          {:error, :invalid, "fatal: a game has at most #{@seats} seats"}

        day_length not in lengths() ->
          {:error, :invalid, "day_length is one of #{Enum.join(lengths(), ", ")}"}

        true ->
          {:ok,
           room |> Ecto.Changeset.change(bots: bots, day_length: day_length) |> Repo.update!()}
      end
    end)
  end

  @doc "The host starts the room's game: members' seats in the order they joined, then the bots. `{:ok, game_id}`."
  def start(code, %Player{} = player) do
    locked(code, fn room ->
      handles = Enum.map(room.members, & &1.player.handle)
      bots = bot_names(room.bots)

      cond do
        room.host_id != player.id ->
          {:error, :not_a_player, "fatal: only the host starts the game"}

        room.game_id ->
          {:error, :over, "fatal: this room's game has started"}

        length(handles) + length(bots) < 2 ->
          {:error, :invalid, "fatal: a game needs at least 2 seats: invite someone, or add a bot"}

        true ->
          holders = Map.new(room.members, &{&1.player.handle, &1.player_id})

          with {:ok, %{id: id}} <-
                 Games.create(handles ++ bots,
                   day_length: room.day_length,
                   bots: bots,
                   holders: holders
                 ) do
            room |> Ecto.Changeset.change(game_id: id) |> Repo.update!()
            {:ok, id}
          end
      end
    end)
  end

  defp bot_names(1), do: ["bot"]
  defp bot_names(n), do: for(i <- 1..n//1, do: "bot-#{i}")

  defp lengths, do: Map.keys(Rules.load!().day_seconds)

  def member?(room, %Player{id: id}), do: Enum.any?(room.members, &(&1.player_id == id))
  def member?(_room, nil), do: false

  # Every write locks the room's row, so two joins can't both take its last seat, and a join can't race the start.
  defp locked(code, f) do
    Repo.transaction(fn ->
      case Repo.one(from r in Room, where: r.code == ^code, lock: "FOR UPDATE") do
        nil ->
          Repo.rollback({:not_found, "fatal: no room #{code}"})

        room ->
          case f.(Repo.preload(room, [:host, members: :player])) do
            {:ok, result} -> result
            {:error, reason, message} -> Repo.rollback({reason, message})
            {:error, reason} -> Repo.rollback({reason, "fatal: #{reason}"})
          end
      end
    end)
    |> case do
      {:ok, result} ->
        Signal.broadcast({:room, code}, started?(code))
        {:ok, result}

      {:error, {reason, message}} ->
        {:error, reason, message}
    end
  end

  defp started?(code), do: match?({:ok, %Room{game_id: id}} when id != nil, get(code))

  @doc "The room as the API shows it to `viewer`."
  def view(%Room{} = room, viewer) do
    %{
      code: room.code,
      host: room.host.handle,
      members: Enum.map(room.members, &Player.public(&1.player)),
      bots: room.bots,
      day_length: room.day_length,
      seats: @seats,
      game_id: room.game_id,
      you: %{member: member?(room, viewer), host: viewer != nil and viewer.id == room.host_id}
    }
  end
end
