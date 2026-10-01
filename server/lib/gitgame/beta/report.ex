defmodule GitGame.Beta.Report do
  @moduledoc """
  The beta's numbers (M12, ADR-0002), from every game with a person in it and from the marks. Each game is read as
  the server always reads one, by folding its log (ADR-0004), and its raw log adds when each pack was sent. Bots'
  seats are left out throughout: the questions are about people.

  - **games:** started, finished, and finished by people still in the company, whose share is the charter's "≥ 50% of
    started games reach a release";
  - **send timing** (playtest question 1): how far into its day each pack was sent, in thirds, against whether its
    push went through;
  - **failed pushes** (question 2): what the player who failed did next;
  - **absences** (question 3): packs that never came, and who left the company;
  - **replays**, and **returning** players: back on another day unprompted, or starting a game after finishing one;
  - **feedback:** how many notes people left at the end of their games (M13b).

  `since:` a date counts only the games started on or after it, and the visits and replays marked on or after it, so the
  games played while the beta was built and tested don't count as strangers' (M13a).
  """
  import Ecto.Query
  alias GitGame.{Games, Repo}
  alias GitGame.Beta.Mark
  alias GitGame.Games.{Record, Seat}

  def build(opts \\ []) do
    since = opts[:since]
    held = Repo.all(seats(since))

    people = Enum.group_by(held, &elem(&1, 0), &elem(&1, 1))

    histories =
      Repo.all(from r in Record, where: r.id in ^Map.keys(people)) |> Enum.map(&Games.history/1)

    %{
      games: games(histories, people),
      send_timing: timing(histories, people),
      failed_pushes: failed(histories, people),
      absences: absences(histories, people),
      replays: replays(histories, since),
      returning: returning(held, histories, since),
      feedback: feedback(since)
    }
  end

  # people's seats, in the games started since the date
  defp seats(nil),
    do: from(s in Seat, where: not is_nil(s.player_id), select: {s.game_id, s.seat, s.player_id})

  defp seats(since) do
    from s in seats(nil),
      join: g in Record,
      on: g.id == s.game_id,
      where: g.inserted_at >= ^DateTime.new!(since, ~T[00:00:00.000000])
  end

  defp marks(kind, nil), do: from(m in Mark, where: m.kind == ^kind)
  defp marks(kind, since), do: from(m in marks(kind, nil), where: m.day >= ^since)

  # A game whose people have all left the company plays itself to its release with the bots, since a bot sends as each
  # day opens; it reached a release, but nobody finished it. The share is of games people finished.
  defp games(histories, people) do
    released = Enum.filter(histories, & &1.state.game.released)

    by_people =
      Enum.count(released, fn h ->
        Enum.any?(people[h.record.id], &(not h.state.game.players[&1].left))
      end)

    %{
      started: length(histories),
      finished: length(released),
      finished_by_people: by_people,
      share: share(by_people, length(histories))
    }
  end

  # ---------- question 1: when a pack was sent, against how its push went ----------

  defp timing(histories, people) do
    for h <- histories,
        {day, seat, sent_at} <- packs(h, people[h.record.id]),
        reduce: empty_thirds() do
      acc ->
        opened = opened_at(h.events, day)
        length = h.state.game.rules.day_seconds[h.record.day_length]
        third = min(div(DateTime.diff(sent_at, opened) * 3, length), 2)
        Map.update!(acc, third_name(third), &tally(&1, outcome(log(h, day), seat)))
    end
  end

  defp tally(counts, outcome),
    do: counts |> Map.update!(:packs, &(&1 + 1)) |> Map.update!(outcome, &(&1 + 1))

  defp empty_thirds,
    do: Map.new(~w(first middle last)a, &{&1, %{packs: 0, pushed: 0, rejected: 0, no_push: 0}})

  defp third_name(0), do: :first
  defp third_name(1), do: :middle
  defp third_name(_), do: :last

  # A person's last pack of each closed day: a later pack replaces an earlier one.
  defp packs(h, seats) do
    closed = length(h.state.days)

    h.events
    |> Enum.filter(&(&1.type == "pack_sent" and &1.player in seats and &1.day <= closed))
    |> Enum.group_by(&{&1.day, &1.player})
    |> Enum.map(fn {{day, seat}, sent} -> {day, seat, List.last(sent).inserted_at} end)
  end

  defp opened_at(events, 1), do: Enum.find(events, &(&1.type == "game_created")).inserted_at

  defp opened_at(events, day),
    do: Enum.find(events, &(&1.type == "day_closed" and &1.day == day - 1)).inserted_at

  defp log(h, day), do: Enum.find(h.state.days, &(&1.day == day)).log

  defp outcome(log, seat) do
    cond do
      Enum.any?(log, &(&1.type == :push_accepted and &1.player == seat)) ->
        :pushed

      Enum.any?(log, &(&1[:op] == :push and &1.type == :op_failed and &1.player == seat)) ->
        :rejected

      true ->
        :no_push
    end
  end

  # ---------- question 2: after a failed push ----------

  defp failed(histories, people) do
    for h <- histories,
        {%{log: log}, i} <- Enum.with_index(h.state.days),
        {e, at} <- Enum.with_index(log),
        e.type == :op_failed and e.op == :push and e.player in people[h.record.id],
        reduce: %{total: 0, pull: 0, push: 0, other: 0, nothing: 0} do
      acc ->
        next =
          next_op(Enum.drop(log, at + 1), e.player) || next_op(next_day(h, i), e.player) ||
            :nothing

        acc |> Map.update!(:total, &(&1 + 1)) |> Map.update!(next, &(&1 + 1))
    end
  end

  defp next_day(h, i), do: (Enum.at(h.state.days, i + 1) || %{log: []}).log

  # the next op of `seat`'s, as the kind a playtester would note: a pull, another push, or something else
  defp next_op(log, seat) do
    Enum.find_value(log, fn
      %{player: ^seat, type: t} when t in [:pulled, :pull_up_to_date, :conflict_detected] -> :pull
      %{player: ^seat, type: t} when t in [:push_accepted, :push_up_to_date] -> :push
      %{player: ^seat, type: :op_failed, op: :push} -> :push
      %{player: ^seat, type: t} when t in [:pack_opened, :pack_closed, :drew, :hand_limit] -> nil
      %{player: ^seat} -> :other
      _ -> nil
    end)
  end

  # ---------- question 3: absences ----------

  defp absences(histories, people) do
    events =
      for h <- histories,
          %{log: log} <- h.state.days,
          e <- log,
          e[:player] in people[h.record.id],
          do: {h.record.id, e}

    left = for {game, %{type: :left_the_company}} <- events, do: game

    %{
      empty_packs: Enum.count(events, &match?({_, %{type: :empty_pack}}, &1)),
      left_the_company: length(left),
      games_someone_left: left |> Enum.uniq() |> length()
    }
  end

  # ---------- the exit: replays, and people coming back ----------

  defp replays(histories, since) do
    marks = Repo.all(marks("replay", since))
    finished = for h <- histories, h.state.game.released, into: MapSet.new(), do: h.record.id

    %{
      opened: length(marks),
      players:
        marks |> Enum.map(& &1.player_id) |> Enum.reject(&is_nil/1) |> Enum.uniq() |> length(),
      finished_games_replayed:
        marks
        |> Enum.map(& &1.game_id)
        |> Enum.filter(&(&1 in finished))
        |> Enum.uniq()
        |> length()
    }
  end

  defp returning(held, histories, since) do
    unprompted_days =
      Repo.all(
        from m in marks("visit", since),
          where: is_nil(m.via),
          group_by: m.player_id,
          having: count(m.day) >= 2,
          select: m.player_id
      )

    %{
      came_back_another_day: length(unprompted_days),
      played_again_after_finishing: played_again(held, histories)
    }
  end

  # people who started a game after one of theirs had been released
  defp played_again(held, histories) do
    at = Map.new(histories, fn h -> {h.record.id, {h.record.inserted_at, released_at(h)}} end)

    held
    |> Enum.group_by(&elem(&1, 2), &elem(&1, 0))
    |> Enum.count(fn {_player, games} ->
      ends = for g <- games, {_, done} = at[g], done != nil, do: done

      Enum.any?(games, fn g -> Enum.any?(ends, &(DateTime.compare(elem(at[g], 0), &1) == :gt)) end)
    end)
  end

  defp released_at(%{state: %{game: %{released: nil}}}), do: nil

  defp released_at(h),
    do:
      h.events
      |> Enum.filter(&(&1.type == "day_closed"))
      |> List.last()
      |> Map.fetch!(:inserted_at)

  # what people said at the end of their games (M13b); `--feedback` prints the notes themselves
  defp feedback(since) do
    notes = GitGame.Feedback.list(since)
    %{notes: length(notes), players: notes |> Enum.map(& &1.handle) |> Enum.uniq() |> length()}
  end

  defp share(_, 0), do: nil
  defp share(n, of), do: Float.round(n / of, 3)
end
