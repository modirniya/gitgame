defmodule GitGame.Games.View do
  @moduledoc """
  What everyone at the table may see of a game (round-resolution §4: `fetch` shows `main`, every pointer, who has sent
  today's pack, and the day logs). A face-down commit shows only what was announced when it was pushed: its author,
  files, lines and message; whether it is a bug shows only once it is flipped. Hands, staging areas and local branches
  appear as counts. `for_player/3` adds your own side of the table; the day logs come projected for the reader
  (`GitGame.Games.Projection`), so nothing in either view is anything its reader couldn't see at a real table.
  """
  alias GitGame.{Game, Release, Resolver}
  alias GitGame.Games.Projection

  def public(%{game: %Game{} = game, version: version, sent: sent} = state, id) do
    logs(state, nil)
    |> Map.merge(%{
      id: id,
      version: version,
      day: game.day,
      final_day: game.final_day,
      day_length: game.length,
      # what's on the table for today: the budget the incident allows, whether command cards may be played
      budget: Resolver.budget(game),
      commands_allowed: not match?(%{effect: %{kind: :no_commands}}, game.incident),
      release_at: game.rules.release_at[length(game.seats)],
      hand_limit: game.rules.hand_limit,
      max_ops: game.rules.pack_max_ops,
      # whether this game's days are long enough to be reminded of (ADR-0006)
      reminders: GitGame.Notifications.worth?(game.rules.day_seconds[game.length]),
      # how a pull settles a conflict when its pack declares no strategy
      default_strategy: game.rules.default_conflict_strategy,
      # what each op costs under this game's rules, for a client to show before the pack is sent; some are free when
      # there is nothing to do, which only the remote can know when the pack runs
      costs: %{
        ops: game.rules.op_costs,
        commands: Map.new(game.rules.commands, fn {id, c} -> {id, c.cost} end)
      },
      # when the open day closes if not every pack is in first; nil once the game is over
      deadline: if(game.released, do: nil, else: state[:deadline]),
      incident: game.incident && Map.take(game.incident, [:id, :name, :text]),
      released: game.released,
      seats: game.seats,
      bots: Map.get(state, :bots, []),
      sent_today: sent,
      main: Enum.map(game.main, &commit/1),
      players: Map.new(game.seats, &{&1, player(game, &1)}),
      scores: Release.scores(game)
    })
  end

  @doc "The public view, plus `viewer`'s own cards, branch and traps, with the day logs as `viewer` may see them."
  def for_player(%{game: %Game{} = game} = state, id, viewer) do
    p = game.players[viewer]

    state
    |> public(id)
    |> Map.merge(logs(state, viewer))
    |> Map.put(:you, %{
      player: viewer,
      hand: p.hand,
      staged: p.staged,
      local: p.local,
      armed: p.armed,
      left: p.left
    })
  end

  defp logs(state, viewer) do
    %{
      days:
        Enum.map(
          Map.get(state, :days, []),
          &%{day: &1.day, log: Projection.events(&1.log, viewer), opened: &1.opened}
        ),
      today: Projection.events(Map.get(state, :opened, []), viewer)
    }
  end

  @doc """
  The table as a day opened, as everyone may see it: `main`, each pointer and how far behind it is, and the scores.
  Each closed day keeps one, so a client can draw `main` at every step of that day's playback (M15f) and show the
  scores as the day opened rather than recompute them step by step, which would mean writing the scoring rules twice.
  """
  def opening(%Game{} = game) do
    %{
      main: Enum.map(game.main, &commit/1),
      players: Map.new(game.seats, &{&1, Map.take(player(game, &1), [:pointer, :behind])}),
      scores: Release.scores(game)
    }
  end

  defp commit(%{initial: true} = c), do: %{id: c.id, initial: true}

  defp commit(c) do
    announced = %{
      id: c.id,
      author: c.author,
      message: c[:message] || "",
      files: c.cards |> Enum.map(& &1.file) |> Enum.uniq(),
      lines: c.cards |> Enum.map(& &1.lines) |> Enum.sum(),
      flipped: c.flipped,
      overwritten: !!c[:overwritten],
      reverted: !!c[:reverted],
      revert_of: c[:revert_of]
    }

    if c.flipped, do: Map.put(announced, :bug, Enum.any?(c.cards, & &1.bug)), else: announced
  end

  defp player(game, id) do
    p = game.players[id]

    %{
      pointer: p.pointer,
      behind: Game.behind_by(game, id),
      hand: length(p.hand),
      staged: length(p.staged),
      to_push: length(p.local),
      tokens: %{merge: p.merge, grudges: p.grudges, sins: p.sins, blame: p.blame, fixes: p.fixes},
      left: p.left
    }
  end
end
