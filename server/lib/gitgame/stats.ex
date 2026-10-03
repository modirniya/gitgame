defmodule GitGame.Stats do
  @moduledoc """
  A pulse for the maintainer (M13e): that the game is being played, not how well. Counted by day in UTC from the
  tables there already are, from a fresh start (`STATS_SINCE`) and without the team's test players (`STATS_TEAM`,
  their handles); the numbers that decide anything are the beta report's (`GitGame.Beta.Report`). Bots hold no seat,
  so their packs are never counted.
  """
  import Ecto.Query
  alias GitGame.{Games, Repo}
  alias GitGame.Beta.Mark
  alias GitGame.Games.{CloseDay, Event, Record, Seat}
  alias GitGame.Players.Player

  @days 365

  @doc """
  `days`: one row per day for the last year up to `today`, zeros included, of new players, games started, packs sent by
  people and visits. `totals` since the start, and the `pulse`: when a person last sent a pack, when the last game
  started, and how many games are in progress. `since` and `team` default to the deployment's settings; `left_out` is
  how many of the team's handles are players.
  """
  def build(today \\ Date.utc_today(), opts \\ []) do
    since = Keyword.get(opts, :since, Application.get_env(:gitgame, :stats_since))
    team = Keyword.get(opts, :team, Application.get_env(:gitgame, :stats_team, []))
    out = Repo.all(from p in Player, where: p.handle in ^team, select: p.id)

    first = Date.add(today, 1 - @days)
    window = later(DateTime.new!(first, ~T[00:00:00]), since)

    q = %{
      players: from(p in Player, where: p.id not in ^out),
      games: games(out),
      packs: packs(out),
      visits: from(m in Mark, where: m.kind == "visit" and m.player_id not in ^out)
    }

    counts =
      Map.new(q, fn {key, query} ->
        {key, by_day(from(r in query, where: r.inserted_at >= ^window))}
      end)

    %{
      since: since,
      left_out: length(out),
      days:
        for date <- Date.range(first, today) do
          Map.new(counts, fn {key, per_day} -> {key, Map.get(per_day, date, 0)} end)
          |> Map.put(:date, date)
        end,
      totals:
        Map.new(Map.take(q, [:players, :games, :packs]), fn {k, query} ->
          {k, Repo.aggregate(starting(query, since), :count)}
        end),
      pulse: %{
        last_pack: Repo.one(from e in starting(q.packs, since), select: max(e.inserted_at)),
        last_game: Repo.one(from g in starting(q.games, since), select: max(g.inserted_at)),
        in_progress: in_progress(starting(q.games, since))
      }
    }
  end

  # the games someone outside the team holds a seat in
  defp games(out) do
    from g in Record,
      as: :game,
      where:
        exists(
          from s in Seat, where: s.game_id == parent_as(:game).id and s.player_id not in ^out
        )
  end

  # the packs people outside the team sent, a replaced pack included; a bot holds no seat
  defp packs(out) do
    from e in Event,
      join: s in Seat,
      on: s.game_id == e.game_id and s.seat == e.player,
      where: e.type == "pack_sent" and s.player_id not in ^out
  end

  defp starting(query, nil), do: query
  defp starting(query, since), do: from(r in query, where: r.inserted_at >= ^since)

  defp later(at, nil), do: at
  defp later(at, since), do: if(DateTime.compare(since, at) == :gt, do: since, else: at)

  defp by_day(query) do
    query
    |> group_by([r], fragment("?::date", r.inserted_at))
    |> select([r], {fragment("?::date", r.inserted_at), count()})
    |> Repo.all()
    |> Map.new()
  end

  # Whether a game has shipped is known only by folding its log. Every game still being played has its next day's
  # deadline waiting as a job, so only those games are folded; a finished game's jobs left from days that closed early
  # are why each is folded rather than counted.
  defp in_progress(games) do
    ids =
      Repo.all(
        from j in Oban.Job,
          where:
            j.worker == ^inspect(CloseDay) and
              j.state in ~w(available scheduled executing retryable),
          distinct: true,
          select: j.args["game_id"]
      )

    from(g in games, where: g.id in ^ids)
    |> Repo.all()
    |> Enum.count(&(Games.history(&1).state.game.released == nil))
  end
end
