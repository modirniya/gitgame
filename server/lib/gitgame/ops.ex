defmodule GitGame.Ops do
  @moduledoc """
  One op of a pack, as the remote runs it: what it costs, and what it does. The resolver (M3) spends a pack's budget
  op by op without knowing what any op means; each family of ops lives in its own module behind this one:

  - `GitGame.Ops.Local`: ops on your own side of the table (`add`, `commit`, arming a trap)
  - `GitGame.Ops.Remote`: ops that meet everyone else's work on `main` (`push`, `pull`, `pull --rebase`)
  - command cards follow (M2e)

  `cost/3` is asked at the moment the op runs, because some ops are free when there is nothing to do. `run/3` returns
  `{:ok, game, events}` or `{:failed, game, events}`; a failure is reported in Git's own words and, per
  `rules/online.json`, still costs its ops.
  """
  alias GitGame.Game

  @callback cost(Game.t(), player :: String.t(), op :: map()) :: non_neg_integer()
  @callback run(Game.t(), player :: String.t(), op :: map()) ::
              {:ok | :failed, Game.t(), [map()]}

  @families %{
    add: GitGame.Ops.Local,
    commit: GitGame.Ops.Local,
    arm: GitGame.Ops.Local,
    push: GitGame.Ops.Remote,
    pull: GitGame.Ops.Remote
  }

  def cost(game, player, %{op: op} = o) do
    case Map.fetch(@families, op) do
      {:ok, family} -> family.cost(game, player, o)
      :error -> 0
    end
  end

  def run(game, player, %{op: op} = o) do
    case Map.fetch(@families, op) do
      {:ok, family} -> family.run(game, player, o)
      :error -> failed(game, player, op, "git: '#{op}' is not a git command. See 'git --help'.")
    end
  end

  @doc "A failed op: the state unchanged, and one event saying why, in Git's words."
  def failed(game, player, op, message),
    do: {:failed, game, [%{type: :op_failed, player: player, op: op, message: message}]}
end
