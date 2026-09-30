defmodule GitGame.Ops.LocalTest do
  use ExUnit.Case, async: true
  alias GitGame.{Game, Ops, Rules}

  setup_all do: %{rules: Rules.load!()}

  # A two-player game with ana's hand replaced by cards we choose.
  defp table(rules, hand) do
    game = Game.new(rules, 7, ["ana", "raj"])
    Game.put_player(game, "ana", %{game.players["ana"] | hand: hand})
  end

  @auth %{id: "c1", kind: :commit, file: "auth.js", lines: 4, bug: false}
  @api %{id: "c2", kind: :commit, file: "api.py", lines: 2, bug: true}
  @reflog %{id: "r1", kind: :command, command: "reflog"}

  test "add stages the chosen commit cards and costs 1", %{rules: rules} do
    game = table(rules, [@auth, @api, @reflog])
    assert Ops.cost(game, "ana", %{op: :add, cards: ["c1", "c2"]}) == 1

    assert {:ok, game, [%{type: :staged, cards: [@auth, @api]}]} =
             Ops.run(game, "ana", %{op: :add, cards: ["c1", "c2"]})

    assert game.players["ana"].hand == [@reflog]
    assert game.players["ana"].staged == [@auth, @api]
  end

  test "add of a card you don't hold, or of a command card, fails in Git's words", %{rules: rules} do
    game = table(rules, [@auth, @reflog])

    assert {:failed, ^game, [%{message: "fatal: pathspec 'zz' did not match any files"}]} =
             Ops.run(game, "ana", %{op: :add, cards: ["c1", "zz"]})

    assert {:failed, ^game, _} = Ops.run(game, "ana", %{op: :add, cards: ["r1"]})

    assert {:failed, ^game, [%{message: "Nothing specified, nothing added."}]} =
             Ops.run(game, "ana", %{op: :add, cards: []})
  end

  test "commit turns everything staged into one commit on the local branch", %{rules: rules} do
    {:ok, game, _} = Ops.run(table(rules, [@auth, @api]), "ana", %{op: :add, cards: ["c1", "c2"]})
    assert Ops.cost(game, "ana", %{op: :commit}) == 1

    assert {:ok, game, [%{type: :committed, commit: commit}]} =
             Ops.run(game, "ana", %{op: :commit, message: "feat(auth): refresh tokens"})

    assert %{
             author: "ana",
             cards: [@auth, @api],
             message: "feat(auth): refresh tokens",
             flipped: false
           } = commit

    assert commit.id =~ ~r/^[0-9a-f]{7}$/
    assert game.players["ana"].staged == []
    assert game.players["ana"].local == [commit]
  end

  test "two commits get different hashes; the same game gives the same hashes", %{rules: rules} do
    run = fn ->
      {:ok, g, _} = Ops.run(table(rules, [@auth, @api]), "ana", %{op: :add, cards: ["c1"]})
      {:ok, g, _} = Ops.run(g, "ana", %{op: :commit})
      {:ok, g, _} = Ops.run(g, "ana", %{op: :add, cards: ["c2"]})
      {:ok, g, _} = Ops.run(g, "ana", %{op: :commit})
      Enum.map(g.players["ana"].local, & &1.id)
    end

    [a, b] = run.()
    refute a == b
    assert run.() == [a, b]
  end

  test "commit with nothing staged fails", %{rules: rules} do
    game = table(rules, [@auth])

    assert {:failed, ^game,
            [%{type: :op_failed, op: :commit, message: "nothing added to commit"}]} =
             Ops.run(game, "ana", %{op: :commit})
  end

  test "arming a reflog is free and plays the card face-down; only one at a time", %{rules: rules} do
    game = table(rules, [@auth, @reflog, %{@reflog | id: "r2"}])
    assert Ops.cost(game, "ana", %{op: :arm, trap: "reflog"}) == 0

    assert {:ok, game, [%{type: :armed, trap: "reflog"}]} =
             Ops.run(game, "ana", %{op: :arm, trap: "reflog"})

    assert game.players["ana"].armed == ["reflog"]
    assert length(game.players["ana"].hand) == 2
    assert {:failed, ^game, _} = Ops.run(game, "ana", %{op: :arm, trap: "reflog"})
  end

  test "arming without the card fails", %{rules: rules} do
    game = table(rules, [@auth])

    assert {:failed, ^game, [%{message: "error: no reflog card in hand"}]} =
             Ops.run(game, "ana", %{op: :arm, trap: "reflog"})
  end

  test "an op that doesn't exist fails the way Git does", %{rules: rules} do
    game = table(rules, [@auth])

    assert {:failed, ^game, [%{message: "git: 'yolo' is not a git command. See 'git --help'."}]} =
             Ops.run(game, "ana", %{op: :yolo})
  end
end
