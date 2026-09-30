defmodule GitGame.Games do
  @moduledoc """
  Games in the database: created, written to by packs, advanced by closing days, and read by folding their log
  through the pure resolver (ADR-0004). No state is stored and no process holds a game (charter decisions 8 and 9):
  a request a second or a week after the last one does the same thing, which is read the log and fold it.

  Days run on a clock (M5): each day's deadline is when it opened plus the day length in the game's rules, and a job
  closes it then (`GitGame.Games.CloseDay`), or sooner, the moment every player still in the game has sent a pack.

  Every write locks the game's row for its transaction, so two writes to one game never interleave, and carries the
  game version it was written against: once a day has closed, a pack written before it is rejected, as Git rejects a
  push to a remote that has moved on.
  """
  import Ecto.Query
  alias GitGame.{Game, Repo, Resolver, Rules}
  alias GitGame.Games.{CloseDay, Event, Pack, Record}

  # Seeds stay below 2^53, so they survive a round trip through JSON numbers in any client.
  @max_seed 9_007_199_254_740_991
  @stale "! [rejected]        main -> main (fetch first)"

  @doc "A new game for `seats`, with the rules as they are now. Options: `:day_length` (default \"live\"), `:seed`."
  def create(seats, opts \\ []) do
    maps = Rules.read_maps!()
    rules = Rules.from_maps!(maps["deck"], maps["online"])
    length = Keyword.get(opts, :day_length, "live")
    seed = Keyword.get_lazy(opts, :seed, fn -> :rand.uniform(@max_seed) end)

    with :ok <- check_new(rules, seed, seats, length) do
      Repo.transaction(fn ->
        record = Repo.insert!(%Record{seed: seed, seats: seats, day_length: length, rules: maps})
        created = Repo.insert!(%Event{game_id: record.id, seq: 1, type: "game_created", day: 0})
        schedule_close(record.id, 1, deadline(created.inserted_at, rules, length))
        %{id: record.id, version: 1}
      end)
    end
  end

  defp check_new(rules, seed, seats, length) do
    Game.new(rules, seed, seats, length)
    :ok
  rescue
    e in ArgumentError -> {:error, :invalid, Exception.message(e)}
  end

  @doc """
  The game as its log makes it: `%{game: current state, version: ..., days: [%{day, log}], opened: this day's opening
  events, sent: who has sent a pack for the open day}`, or `{:error, :not_found}`.
  """
  def load(id) do
    case Repo.get(Record, id) do
      nil -> {:error, :not_found}
      record -> {:ok, fold(record, events(id))}
    end
  end

  @doc "Stores `player`'s pack for the open day, replacing any earlier one. `json` is the pack as it arrived."
  def send_pack(id, player, version, json) do
    locked(id, fn record, state ->
      p = state.game.players[player]

      cond do
        version != state.version -> {:error, :stale, @stale}
        state.game.released -> {:error, :over, "fatal: v1.0 has shipped; the game is over"}
        p == nil -> {:error, :not_a_player, "fatal: #{player} is not in this game"}
        p.left -> {:error, :left, "fatal: #{player} has left the company"}
        true -> store_pack(record, state, player, json)
      end
    end)
  end

  defp store_pack(record, state, player, json) do
    case Pack.decode(json, state.game.rules.pack_max_ops) do
      {:ok, _} ->
        stored = %{"ops" => json["ops"], "discard" => Map.get(json, "discard", [])}
        attrs = %{type: "pack_sent", day: state.game.day, player: player, payload: stored}
        seq = append(record, state, attrs)
        state = %{state | sent: Enum.uniq([player | state.sent]), last_seq: seq}

        # The day closes early the moment every player still in the game has sent a pack (round-resolution §1).
        if state.game.rules.closes_early and everyone_sent?(state),
          do: close_open_day(record, state),
          else: {:ok, %{version: state.version, closed: false}}

      {:error, message} ->
        {:error, :invalid, message}
    end
  end

  @doc """
  Closes `day` (by default whichever is open): resolves its packs and opens the next. A day closes once: asked to
  close a day that has already closed, as racing deadline jobs will, it does nothing.
  """
  def close_day(id, day \\ nil) do
    locked(id, fn record, state ->
      cond do
        day != nil and day < state.game.day ->
          {:ok, %{day: day, version: state.version, already_closed: true}}

        state.game.released ->
          {:error, :over, "fatal: v1.0 has shipped; the game is over"}

        true ->
          close_open_day(record, state)
      end
    end)
  end

  defp close_open_day(record, state) do
    seq =
      append(record, state, %{type: "day_closed", day: state.game.day, player: nil, payload: %{}})

    after_close = fold(record, events(record.id))

    # The next day's deadline is scheduled in the transaction that opens the day, unless the game just ended.
    unless after_close.game.released,
      do: schedule_close(record.id, after_close.game.day, after_close.deadline)

    {:ok, %{day: state.game.day, version: seq, already_closed: false, closed: true}}
  end

  defp everyone_sent?(state),
    do: Enum.all?(state.game.seats, &(state.game.players[&1].left or &1 in state.sent))

  defp deadline(opened_at, rules, length),
    do: DateTime.add(opened_at, rules.day_seconds[length], :second)

  defp schedule_close(id, day, at),
    do: Oban.insert!(CloseDay.new(%{game_id: id, day: day}, scheduled_at: at))

  # ---------- the log ----------

  defp events(id), do: Repo.all(from e in Event, where: e.game_id == ^id, order_by: e.seq)

  defp locked(id, f) do
    Repo.transaction(fn ->
      case Repo.one(from r in Record, where: r.id == ^id, lock: "FOR UPDATE") do
        nil -> Repo.rollback({:not_found, "fatal: no game #{id}"})
        record -> record |> then(&f.(&1, fold(&1, events(id)))) |> commit_or_rollback()
      end
    end)
    |> case do
      {:ok, result} -> {:ok, result}
      {:error, {reason, message}} -> {:error, reason, message}
    end
  end

  defp commit_or_rollback({:ok, result}), do: result
  defp commit_or_rollback({:error, reason, message}), do: Repo.rollback({reason, message})

  defp append(record, state, attrs) do
    seq = state.last_seq + 1
    Repo.insert!(struct(Event, Map.merge(attrs, %{game_id: record.id, seq: seq})))
    seq
  end

  # Folding: the game as created, day 1 open, then every pack and every closed day in order. A pack replaces the same
  # player's earlier pack for that day, and arrives when it was last sent.
  defp fold(record, events) do
    rules = Rules.from_maps!(record.rules["deck"], record.rules["online"])

    {game, opened} =
      rules |> Game.new(record.seed, record.seats, record.day_length) |> Resolver.open_day()

    start = %{
      game: game,
      version: 1,
      days: [],
      opened: opened,
      pending: %{},
      last_seq: 0,
      opened_at: nil
    }

    Enum.reduce(events, start, fn
      %Event{type: "game_created", seq: seq, inserted_at: at}, acc ->
        %{acc | version: seq, last_seq: seq, opened_at: at}

      %Event{type: "pack_sent", seq: seq, player: player, payload: payload}, acc ->
        {:ok, pack} = Pack.decode(payload, acc.game.rules.pack_max_ops)
        %{acc | pending: Map.put(acc.pending, player, {seq, pack}), last_seq: seq}

      %Event{type: "day_closed", seq: seq, day: day, inserted_at: at}, acc ->
        packs =
          acc.pending
          |> Enum.sort_by(fn {_, {s, _}} -> s end)
          |> Enum.map(fn {p, {_, pack}} -> {p, pack} end)

        {game, log} = Resolver.close_day(acc.game, packs)
        {closed, opened} = Enum.split_while(log, &(&1.type != :day_opened))

        %{
          acc
          | game: game,
            days: acc.days ++ [%{day: day, log: closed}],
            opened: opened,
            pending: %{},
            version: seq,
            last_seq: seq,
            opened_at: at
        }
    end)
    |> then(fn acc ->
      acc
      |> Map.put(:sent, acc.pending |> Map.keys() |> Enum.sort())
      |> Map.put(:deadline, deadline(acc.opened_at, rules, record.day_length))
      |> Map.delete(:pending)
    end)
  end
end
