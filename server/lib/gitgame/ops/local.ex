defmodule GitGame.Ops.Local do
  @moduledoc """
  Ops on your own side of the table, which never touch anyone else (round-resolution §2): `add` stages cards from your
  hand, `commit` turns everything staged into one commit on your local branch, `arm` sets a trap face-down.
  """
  @behaviour GitGame.Ops
  import GitGame.Ops, only: [failed: 4]
  alias GitGame.{Game, Seeded}
  import Game, only: [put_player: 3]

  @impl true
  def cost(%Game{rules: r}, _player, %{op: :add}), do: r.op_costs.add
  def cost(%Game{rules: r}, _player, %{op: :commit}), do: r.op_costs.commit
  def cost(%Game{rules: r}, _player, %{op: :arm}), do: r.op_costs.arm_trap

  @impl true
  def run(game, player, %{op: :add, cards: ids}) do
    p = game.players[player]
    {cards, missing} = Enum.reduce(ids, {[], []}, &take_commit_card(&1, &2, p.hand))

    cond do
      ids == [] ->
        failed(game, player, :add, "Nothing specified, nothing added.")

      missing != [] ->
        failed(game, player, :add, "fatal: pathspec '#{hd(missing)}' did not match any files")

      true ->
        p = %{p | hand: p.hand -- cards, staged: p.staged ++ cards}
        {:ok, put_player(game, player, p), [%{type: :staged, player: player, cards: cards}]}
    end
  end

  def run(game, player, %{op: :commit} = op) do
    p = game.players[player]

    if p.staged == [] do
      failed(game, player, :commit, "nothing added to commit")
    else
      commit = %{
        id: Seeded.sha(game.seed, game.next_commit),
        author: player,
        cards: p.staged,
        message: Map.get(op, :message, ""),
        flipped: false
      }

      p = %{p | staged: [], local: p.local ++ [commit]}
      game = %{put_player(game, player, p) | next_commit: game.next_commit + 1}
      {:ok, game, [%{type: :committed, player: player, commit: commit}]}
    end
  end

  # A trap is a command card played face-down from your hand; it fires later, during someone else's pack.
  def run(game, player, %{op: :arm, trap: trap}) do
    p = game.players[player]
    card = Enum.find(p.hand, &(&1.kind == :command and &1.command == trap))

    cond do
      trap in p.armed ->
        failed(game, player, :arm, "error: a #{trap} is already armed")

      card == nil ->
        failed(game, player, :arm, "error: no #{trap} card in hand")

      true ->
        # the card is on the table face-down from now on: out of the hand, never back in it
        p = %{p | hand: List.delete(p.hand, card), armed: p.armed ++ [trap]}

        {:ok, game |> put_player(player, p) |> Game.discard(card),
         [%{type: :armed, player: player, trap: trap}]}
    end
  end

  defp take_commit_card(id, {cards, missing}, hand) do
    case Enum.find(hand, &(&1.id == id and &1.kind == :commit)) do
      nil -> {cards, missing ++ [id]}
      card -> {cards ++ [card], missing}
    end
  end
end
