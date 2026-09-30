defmodule GitGame.Release do
  @moduledoc """
  The end of the game (base-rules "The release"): `git tag v1.0`, once `main` is the release size, runs CI. CI flips
  every commit on `main`; each live bug not already blamed counts against its author. If enough bugs reach
  production it goes down: the release fails and the least blame wins. Otherwise the highest total wins.

  It is also the one place scores are counted, live or final. While the game runs, a face-down bug counts as clean,
  so the live score can never give a hidden bug away (a play-vs-bot finding).
  """
  @behaviour GitGame.Ops
  import GitGame.Ops, only: [failed: 4]
  alias GitGame.Game

  @impl true
  def cost(game, _player, %{op: :tag}), do: game.rules.op_costs.tag

  @impl true
  def run(game, player, %{op: :tag}) do
    size = game.rules.release_at[length(game.seats)]
    have = Game.commits_on_main(game)

    if have < size do
      commits = if have == 1, do: "1 commit", else: "#{have} commits"
      failed(game, player, :tag, "error: main has #{commits}; v1.0 needs #{size}")
    else
      {game, ci} = ci(game, player)
      {:ok, game, [%{type: :tagged, player: player, message: "git tag -a v1.0"}, ci]}
    end
  end

  @doc "Runs CI: every commit face-up, unblamed live bugs counted, the game over. `by` is who tagged, or nil at the deadline."
  def ci(game, by) do
    {main, flips} =
      Enum.map_reduce(game.main, [], fn commit, flips ->
        if commit[:initial] || commit[:revert_of] do
          {commit, flips}
        else
          counts = live_bug?(commit)

          {%{commit | flipped: true} |> Map.put(:blamed, counts || commit[:blamed]),
           flips ++
             [
               %{
                 commit: commit.id,
                 author: commit.author,
                 bug: counts,
                 blamed_now: counts and !commit[:blamed]
               }
             ]}
        end
      end)

    game =
      Enum.reduce(flips, %{game | main: main}, fn
        %{blamed_now: true, author: a}, g -> update_in(g.players[a].blame, &(&1 + 1))
        _, g -> g
      end)

    bugs = Enum.count(flips, & &1.bug)

    released = %{
      by: by,
      day: game.day,
      bugs: bugs,
      production_down: bugs >= game.rules.production_down_at
    }

    {%{game | released: released}, Map.merge(%{type: :ci_ran, flips: flips}, released)}
  end

  @doc """
  Each player's score, broken down: the lines of their commits on `main` that count (not overwritten, not reverted,
  not a flipped bug), and every token and fix at its value from `rules/deck.json`'s scoring.
  """
  def scores(%Game{} = game) do
    s = game.rules.scoring

    Map.new(game.seats, fn id ->
      p = game.players[id]

      lines =
        for c <- game.main,
            c.author == id,
            counts_for_lines?(c),
            card <- c.cards,
            reduce: 0,
            do: (acc -> acc + card.lines)

      parts = %{
        lines: lines,
        fixes: p.fixes * s.revert_played,
        blame: p.blame * s.bug_blamed,
        merge: p.merge * s.merge_token,
        grudges: p.grudges * s.grudge_token,
        sins: p.sins * s.sin_token
      }

      {id, Map.put(parts, :total, parts |> Map.values() |> Enum.sum())}
    end)
  end

  @doc "Who won a released game; ties share the win."
  def winners(%Game{released: nil}), do: []

  def winners(%Game{released: released} = game) do
    scores = scores(game)
    key = if released.production_down, do: & &1.blame, else: & &1.total
    best = scores |> Map.values() |> Enum.map(key) |> Enum.max()
    for id <- game.seats, key.(scores[id]) == best, do: id
  end

  defp counts_for_lines?(c),
    do:
      !c[:initial] and !c[:revert_of] and !c[:overwritten] and !c[:reverted] and
        !(c.flipped and bug?(c))

  defp live_bug?(c), do: bug?(c) and !c[:overwritten] and !c[:reverted]
  defp bug?(c), do: Enum.any?(c.cards, & &1.bug)
end
