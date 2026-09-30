defmodule GitGame.Games.View do
  @moduledoc """
  What everyone at the table may see of a game (round-resolution §4: `fetch` shows `main`, every pointer, who has sent
  today's pack, and the day logs). A face-down commit shows only what was announced when it was pushed: its author,
  files, lines and message; whether it is a bug shows only once it is flipped. Hands, staging areas and local branches
  appear as counts. The per-viewer view, with your own cards and the day logs, is M6's.
  """
  alias GitGame.{Game, Release}

  def public(%{game: %Game{} = game, version: version, sent: sent}, id) do
    %{
      id: id,
      version: version,
      day: game.day,
      final_day: game.final_day,
      incident: game.incident && Map.take(game.incident, [:id, :name, :text]),
      released: game.released,
      seats: game.seats,
      sent_today: sent,
      main: Enum.map(game.main, &commit/1),
      players: Map.new(game.seats, &{&1, player(game, &1)}),
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
