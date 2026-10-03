defmodule GitGame.Stats do
  @moduledoc """
  A pulse for the maintainer (M13e): that the game is being played, not how well. Counted by day in UTC from the
  tables there already are, with everyone's activity alike, the team's and tests' too; the numbers that decide
  anything are the beta report's (`GitGame.Beta.Report`). Bots' packs are left out, since they only echo the people's.
  """
  import Ecto.Query
  alias GitGame.{Games, Repo}
  alias GitGame.Beta.Mark
  alias GitGame.Games.{CloseDay, Event, Record}
  alias GitGame.Players.Player

  @days 365

  @doc """
  `days`: one row per day for the last year up to `today`, zeros included, of new players, games started, packs sent by
  people and visits. `totals` over all time, and the `pulse`: when a person last sent a pack, when the last game
  started, and how many games are in progress.
  """
  def build(today \\ Date.utc_today()) do
    since = Date.add(today, 1 - @days)
    from = DateTime.new!(since, ~T[00:00:00])

    counts = %{
      players: by_day(from(p in Player, where: p.inserted_at >= ^from), :inserted_at),
      games: by_day(from(g in Record, where: g.inserted_at >= ^from), :inserted_at),
      packs: by_day(where(packs(), [e], e.inserted_at >= ^from), :inserted_at),
      visits: visits(since)
    }

    %{
      days:
        for date <- Date.range(since, today) do
          Map.new(counts, fn {key, per_day} -> {key, Map.get(per_day, date, 0)} end)
          |> Map.put(:date, date)
        end,
      totals: %{
        players: Repo.aggregate(Player, :count),
        games: Repo.aggregate(Record, :count),
        packs: Repo.aggregate(packs(), :count)
      },
      pulse: %{
        last_pack: Repo.one(from e in packs(), select: max(e.inserted_at)),
        last_game: Repo.one(from g in Record, select: max(g.inserted_at)),
        in_progress: in_progress()
      }
    }
  end

  # the packs people sent: every one, a replaced pack included, but none of the bots'
  defp packs do
    from e in Event,
      join: g in Record,
      on: g.id == e.game_id,
      where: e.type == "pack_sent" and fragment("NOT (? = ANY(?))", e.player, g.bots)
  end

  defp by_day(query, field) do
    query
    |> group_by([r], fragment("?::date", field(r, ^field)))
    |> select([r], {fragment("?::date", field(r, ^field)), count()})
    |> Repo.all()
    |> Map.new()
  end

  # a visit is marked at most once a day for each player (GitGame.Beta)
  defp visits(since) do
    from(m in Mark,
      where: m.kind == "visit" and m.day >= ^since,
      group_by: m.day,
      select: {m.day, count()}
    )
    |> Repo.all()
    |> Map.new()
  end

  # Whether a game has shipped is known only by folding its log. Every game still being played has its next day's
  # deadline waiting as a job, so only those games are folded; a finished game's jobs left from days that closed early
  # are why each is folded rather than counted.
  defp in_progress do
    ids =
      Repo.all(
        from j in Oban.Job,
          where:
            j.worker == ^inspect(CloseDay) and
              j.state in ~w(available scheduled executing retryable),
          distinct: true,
          select: j.args["game_id"]
      )

    from(r in Record, where: r.id in ^ids)
    |> Repo.all()
    |> Enum.count(&(Games.history(&1).state.game.released == nil))
  end
end
