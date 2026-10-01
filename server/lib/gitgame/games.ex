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
  alias GitGame.{Bot, Game, Notifications, Repo, Resolver, Rules}
  alias GitGame.Signal
  alias GitGame.Games.{CloseDay, Event, Guided, Pack, Record, Seat, View}

  # Seeds stay below 2^53, so they survive a round trip through JSON numbers in any client.
  @max_seed 9_007_199_254_740_991
  @stale "! [rejected]        main -> main (fetch first)"

  @doc """
  A new game for `seats`, with the rules as they are now. Options: `:day_length` (default "live"), `:seed`, `:bots`,
  the seats a bot plays, `:holders`, a map from seat to the id of the player who holds it (ADR-0005), and `:guided`,
  for a player's first game: its seed is chosen so that their first push lands (`GitGame.Games.Guided`), unless
  `:seed` names one. A bot sends its pack the moment each day opens, so a game of bots alone plays itself to the
  release as soon as it is created.
  """
  def create(seats, opts \\ []) do
    maps = Rules.read_maps!()
    rules = Rules.from_maps!(maps["deck"], maps["online"])
    length = Keyword.get(opts, :day_length, "live")
    seed = Keyword.get_lazy(opts, :seed, fn -> :rand.uniform(@max_seed) end)
    bots = Keyword.get(opts, :bots, [])
    holders = Keyword.get(opts, :holders, %{})

    with :ok <- check_new(rules, seed, seats, length),
         :ok <- check(bots -- seats == [], "fatal: every bot must have a seat"),
         :ok <-
           check(
             Map.keys(holders) -- (seats -- bots) == [],
             "fatal: only a person's seat is held"
           ) do
      seed =
        if Keyword.get(opts, :guided, false) and not Keyword.has_key?(opts, :seed),
          do: Guided.seed(rules, seats, length, bots, seed),
          else: seed

      Repo.transaction(fn ->
        record =
          Repo.insert!(%Record{
            seed: seed,
            seats: seats,
            day_length: length,
            rules: maps,
            bots: bots
          })

        for {seat, player_id} <- holders,
            do: Repo.insert!(%Seat{game_id: record.id, seat: seat, player_id: player_id})

        created = Repo.insert!(%Event{game_id: record.id, seq: 1, type: "game_created", day: 0})
        deadline = deadline(created.inserted_at, rules, length)
        schedule_close(record.id, 1, deadline)
        Notifications.day_opened(record.id, 1, deadline, rules.day_seconds[length])
        send_bot_packs(record)
        %{id: record.id, version: fold(record, events(record.id)).version}
      end)
    end
  end

  defp check(true, _message), do: :ok
  defp check(false, message), do: {:error, :invalid, message}

  defp check_new(rules, seed, seats, length) do
    Game.new(rules, seed, seats, length)
    :ok
  rescue
    e in ArgumentError -> {:error, :invalid, Exception.message(e)}
  end

  @doc """
  The game as its log makes it: `%{game: current state, version: ..., days: [%{day, log, opened: the table as that day
  opened}], opened: this day's opening events, sent: who has sent a pack for the open day, bots: the seats bots
  play}`, or `{:error, :not_found}`.

  With `through_day: n`, the game as it stood when day `n` closed (day 0: as created), folded from the log up to that
  point and no further, so a replay shows nothing that happened later: not even which packs were in for the next day.
  """
  def load(id, opts \\ []) do
    with %Record{} = record <- Repo.get(Record, id),
         {:ok, events} <- through(events(id), opts[:through_day]) do
      state = fold(record, events)
      # a day in a replay is long over: it has no deadline
      {:ok, if(opts[:through_day], do: %{state | deadline: nil}, else: state)}
    else
      nil -> {:error, :not_found}
      {:error, _, _} = error -> error
    end
  end

  defp through(events, nil), do: {:ok, events}

  # the log starts with game_created
  defp through(events, 0), do: {:ok, Enum.take(events, 1)}

  defp through(events, day) do
    case Enum.find_index(events, &(&1.type == "day_closed" and &1.day == day)) do
      nil -> {:error, :not_found, "fatal: day #{day} hasn't closed"}
      i -> {:ok, Enum.take(events, i + 1)}
    end
  end

  @doc """
  A game's record, its raw log (each event with when it was written), and what the log folds to: what the beta report
  (M12) reads, since it needs when packs were sent as well as how they went.
  """
  def history(%Record{} = record) do
    events = events(record.id)
    %{record: record, events: events, state: fold(record, events)}
  end

  @doc """
  The seats `player_id` holds in the game, in seat order: one, several in a hotseat game, or none (nil holds none).
  `{:error, :not_found}` if there is no such game.
  """
  def seats_held(id, player_id) do
    case Repo.get(Record, id) do
      nil ->
        {:error, :not_found}

      record ->
        held =
          if player_id,
            do:
              Repo.all(
                from s in Seat,
                  where: s.game_id == ^id and s.player_id == ^player_id,
                  select: s.seat
              ),
            else: []

        {:ok, Enum.filter(record.seats, &(&1 in held))}
    end
  end

  @doc """
  The games `player_id` holds a seat in, as the list of your games shows them: those waiting on a pack of yours first
  (soonest deadline first), then games under way, then finished ones (latest first). At most `limit`.
  """
  def list_for(player_id, limit \\ 20) do
    # the most recent games first; finished ones beyond these fall off the list
    ids =
      Repo.all(
        from s in Seat,
          join: r in Record,
          on: r.id == s.game_id,
          where: s.player_id == ^player_id,
          group_by: r.id,
          order_by: [desc: r.inserted_at],
          limit: ^(limit * 2),
          select: r.id
      )

    yours =
      Repo.all(
        from s in Seat,
          where: s.game_id in ^ids and s.player_id == ^player_id,
          select: {s.game_id, s.seat}
      )
      |> Enum.group_by(&elem(&1, 0), &elem(&1, 1))

    Repo.all(from r in Record, where: r.id in ^ids)
    |> Enum.map(&summary(&1, fold(&1, events(&1.id)), yours[&1.id]))
    |> Enum.sort_by(&{rank(&1), &1.sort})
    |> Enum.take(limit)
    |> Enum.map(&Map.delete(&1, :sort))
  end

  defp summary(record, state, held) do
    game = state.game
    yours = Enum.filter(record.seats, &(&1 in held))

    waiting =
      if game.released,
        do: [],
        else: Enum.reject(yours, &(&1 in state.sent or game.players[&1].left))

    %{
      id: record.id,
      seats: record.seats,
      bots: record.bots,
      yours: yours,
      day: game.day,
      final_day: game.final_day,
      day_length: record.day_length,
      deadline: if(game.released, do: nil, else: state.deadline),
      released: game.released != nil,
      waiting_on_you: waiting,
      scores:
        game |> GitGame.Release.scores() |> Map.new(fn {seat, score} -> {seat, score.total} end),
      sort:
        if(game.released,
          do: -DateTime.to_unix(record.inserted_at, :microsecond),
          else: DateTime.to_unix(state.deadline, :microsecond)
        )
    }
  end

  defp rank(%{released: true}), do: 2
  defp rank(%{waiting_on_you: [_ | _]}), do: 0
  defp rank(_), do: 1

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

    # The next day's deadline is scheduled in the transaction that opens the day, unless the game just ended; so are
    # the day's reminders, or the release's news (ADR-0006).
    seconds = after_close.game.rules.day_seconds[record.day_length]

    if after_close.game.released do
      Notifications.released(record.id, state.game.day, seconds)
    else
      schedule_close(record.id, after_close.game.day, after_close.deadline)
      Notifications.day_opened(record.id, after_close.game.day, after_close.deadline, seconds)
      send_bot_packs(record)
    end

    {:ok,
     %{
       day: state.game.day,
       version: seq,
       already_closed: false,
       closed: true,
       over: after_close.game.released != nil
     }}
  end

  # Each bot still in the game writes its pack from its own view, exactly what a person in its seat would see, and
  # sends it through the same door as anyone's. The state is folded afresh for each: a bot's pack can close the day.
  defp send_bot_packs(record) do
    for bot <- record.bots do
      state = fold(record, events(record.id))
      p = state.game.players[bot]

      unless state.game.released || p.left || bot in state.sent do
        pack = state |> View.for_player(record.id, bot) |> Bot.write_pack()
        {:ok, _} = store_pack(record, state, bot, pack)
      end
    end
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
      {:ok, result} ->
        # after the commit, never inside it: a reader told to refetch must find the write already there
        unless result[:already_closed], do: Signal.broadcast({:game, id}, result[:over] == true)
        {:ok, result}

      {:error, {reason, message}} ->
        {:error, reason, message}
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
            # kept already as everyone may see it, and only what a day's playback draws (M15f), not the whole game
            days: acc.days ++ [%{day: day, log: closed, opened: View.opening(acc.game)}],
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
      |> Map.put(:bots, record.bots)
      |> Map.delete(:pending)
    end)
  end
end
