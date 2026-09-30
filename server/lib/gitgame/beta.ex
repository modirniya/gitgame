defmodule GitGame.Beta do
  @moduledoc """
  What the beta records for the playtest it stands in for (ADR-0002), beyond each game's own log: that a player came
  back, and from where, and that someone opened a replay. Marked by the server as it answers, never sent by the
  client, and never shown to players. `mix gitgame.beta_report` reads these and the logs together.
  """
  alias GitGame.Repo
  alias GitGame.Beta.Mark
  alias GitGame.Players.Player

  # Where a visit can say it came from. Anything else counts as coming back unprompted, which is the point: a visit
  # can't be made to look prompted by a made-up source.
  @sources ~w(notification email digest)

  @doc "`player` opened the game today; `via` is where from, if a notification brought them (M10)."
  def visit(%Player{id: id}, via \\ nil),
    do: mark(%{kind: "visit", player_id: id, via: if(via in @sources, do: via)})

  @doc "Someone opened a day of `game_id`'s replay."
  def replay(player, game_id),
    do: mark(%{kind: "replay", player_id: player && player.id, game_id: game_id})

  # at most one of each a day: a second is dropped by the database, not counted twice
  defp mark(attrs) do
    Repo.insert(struct(Mark, Map.put(attrs, :day, Date.utc_today())), on_conflict: :nothing)
    :ok
  end
end
