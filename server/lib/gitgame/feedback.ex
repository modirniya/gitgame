defmodule GitGame.Feedback do
  @moduledoc """
  What players say about a game once it's over (M13b): a note of up to 1000 characters from the scoreboard, one per
  player and game, which they may rewrite. Only someone who held a seat can leave one, and only after the release.
  The maintainer reads them through the beta report (`--feedback`); no player ever sees another's.
  """
  import Ecto.Query
  alias GitGame.{Games, Repo}
  alias GitGame.Feedback.Note

  @max 1000

  def max_length, do: @max

  @doc "The note `player` left on game `id`, or nil."
  def get(player, id), do: Repo.get_by(Note, player_id: player.id, game_id: id)

  @doc "Keeps `body` as `player`'s note on game `id`, replacing one they left before: `{:ok, note}` or an error."
  def put(player, id, body) do
    with {:ok, held} <- Games.seats_held(id, player.id),
         :ok <-
           if(held == [],
             do: {:error, :not_a_player, "fatal: you hold no seat in this game"},
             else: :ok
           ),
         {:ok, state} <- Games.load(id),
         :ok <-
           if(state.game.released,
             do: :ok,
             else: {:error, :not_over, "fatal: the game isn't over yet"}
           ),
         {:ok, body} <- clean(body) do
      Repo.insert(%Note{player_id: player.id, game_id: id, body: body},
        on_conflict: {:replace, [:body, :updated_at]},
        conflict_target: [:player_id, :game_id],
        returning: true
      )
    end
  end

  @doc "Every note left on or after `since` (nil: every note), oldest first, with its player's handle."
  def list(since \\ nil) do
    query =
      from n in Note,
        join: p in assoc(n, :player),
        order_by: n.inserted_at,
        select: %{game_id: n.game_id, handle: p.handle, body: n.body, at: n.updated_at}

    query =
      if since,
        do: where(query, [n], n.inserted_at >= ^DateTime.new!(since, ~T[00:00:00.000000])),
        else: query

    Repo.all(query)
  end

  # Other people's words reach the maintainer's terminal through the report, so control characters (an escape
  # sequence could rewrite the screen) are dropped; line breaks and tabs stay.
  defp clean(body) when is_binary(body) do
    body =
      body
      |> String.replace("\r\n", "\n")
      |> String.replace(~r/[\x{0}-\x{8}\x{B}-\x{1F}\x{7F}-\x{9F}]/u, "")
      |> String.trim()

    if String.length(body) in 1..@max,
      do: {:ok, body},
      else: {:error, :invalid, "fatal: a note is 1 to #{@max} characters"}
  end

  defp clean(_), do: {:error, :invalid, "fatal: a note is 1 to #{@max} characters"}
end
