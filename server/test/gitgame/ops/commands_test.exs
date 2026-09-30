defmodule GitGame.Ops.CommandsTest do
  use ExUnit.Case, async: true
  alias GitGame.{Game, Ops, Rules}

  setup_all do: %{rules: Rules.load!()}

  defp card(id, file, lines, bug \\ false),
    do: %{id: id, kind: :commit, file: file, lines: lines, bug: bug}

  defp cmd(id, command), do: %{id: id, kind: :command, command: command}

  defp table(rules, hands) do
    game = Game.new(rules, 7, Map.keys(hands) |> Enum.sort())

    Enum.reduce(hands, game, fn {id, hand}, g ->
      Game.put_player(g, id, %{g.players[id] | hand: hand})
    end)
  end

  defp play(game, player, ops) do
    Enum.reduce(ops, game, fn op, g ->
      assert {:ok, g, _} = Ops.run(g, player, op)
      g
    end)
  end

  defp ship(game, player, card_ids),
    do:
      play(game, player, [
        %{op: :add, cards: card_ids},
        %{op: :commit},
        %{op: :pull},
        %{op: :push}
      ])

  defp tip(game), do: List.last(game.main)
  defp hand_ids(game, player), do: Enum.map(game.players[player].hand, & &1.id)

  describe "git blame" do
    setup %{rules: rules} do
      game =
        table(rules, %{
          "ana" => [cmd("b1", "blame"), cmd("b2", "blame")],
          "raj" => [card("r1", "auth.js", 8, true), card("r2", "api.py", 5)]
        })

      game = game |> ship("raj", ["r1"])
      bug = tip(game).id
      game = game |> ship("raj", ["r2"])
      %{game: game, bug: bug, clean: tip(game).id}
    end

    test "flips a face-down bug: it counts against its author, and the card is spent", %{
      game: game,
      bug: bug
    } do
      assert Ops.cost(game, "ana", %{op: :blame, target: bug}) == 1

      assert {:ok, game, [%{type: :blamed, target: ^bug, author: "raj", bug: true}]} =
               Ops.run(game, "ana", %{op: :blame, target: bug})

      assert %{flipped: true, blamed: true} = Enum.find(game.main, &(&1.id == bug))
      assert game.players["raj"].blame == 1
      assert hand_ids(game, "ana") == ["b2"]
    end

    test "a clean commit costs the blamer an op and a card, and nobody else anything", %{
      game: game,
      clean: clean
    } do
      assert {:ok, game, [%{bug: false}]} = Ops.run(game, "ana", %{op: :blame, target: clean})
      assert game.players["raj"].blame == 0
      assert hand_ids(game, "ana") == ["b2"]
    end

    test "a commit already face-up, or not on main, fails and keeps the card", %{
      game: game,
      bug: bug
    } do
      game = play(game, "ana", [%{op: :blame, target: bug}])

      assert {:failed, ^game, [%{message: "error: " <> _}]} =
               Ops.run(game, "ana", %{op: :blame, target: bug})

      assert {:failed, ^game, [%{message: "fatal: no such commit abc1234 on main"}]} =
               Ops.run(game, "ana", %{op: :blame, target: "abc1234"})

      assert hand_ids(game, "ana") == ["b2"]
    end

    test "without the card it fails", %{game: game, bug: bug} do
      assert {:failed, ^game, [%{message: "error: no git blame card in hand"}]} =
               Ops.run(game, "raj", %{op: :blame, target: bug})
    end
  end

  describe "git revert" do
    setup %{rules: rules} do
      game =
        table(rules, %{
          "ana" => [cmd("v1", "revert"), cmd("b1", "blame"), card("a1", "README.md", 2)],
          "raj" => [card("r1", "auth.js", 8, true)]
        })

      game = game |> ship("raj", ["r1"])
      bug = tip(game).id
      %{game: play(game, "ana", [%{op: :blame, target: bug}]), bug: bug}
    end

    test "from the tip neutralises a flipped bug with a commit on top: +1", %{
      game: game,
      bug: bug
    } do
      game = play(game, "ana", [%{op: :pull}])

      assert {:ok, game, [%{type: :reverted, target: ^bug, revert: rev, message: msg}]} =
               Ops.run(game, "ana", %{op: :revert, target: bug})

      assert %{id: ^rev, revert_of: ^bug, author: "ana"} = tip(game)
      assert msg =~ ~r/^\[main #{rev}\] Revert /
      assert %{reverted: true} = Enum.find(game.main, &(&1.id == bug))
      assert game.players["ana"].fixes == 1
      assert Game.behind_by(game, "ana") == 0
      assert Game.behind_by(game, "raj") == 1
    end

    test "from behind is rejected: a revert is a commit you push", %{game: game, bug: bug} do
      assert Game.behind_by(game, "ana") > 0

      assert {:failed, ^game, [%{message: "! [rejected]        main -> main (non-fast-forward)"}]} =
               Ops.run(game, "ana", %{op: :revert, target: bug})
    end
  end

  describe "git push --force" do
    setup %{rules: rules} do
      hands = %{
        "ana" => [
          card("a1", "auth.js", 4),
          card("a2", "api.py", 3),
          cmd("rl", "reflog"),
          cmd("v1", "revert"),
          cmd("bl", "blame")
        ],
        "raj" => [card("r1", "README.md", 2), cmd("f1", "force"), cmd("f2", "force")]
      }

      # raj commits while at the tip, then ana ships two commits: raj is 2 behind with a commit to push
      game =
        table(rules, hands)
        |> play("raj", [%{op: :add, cards: ["r1"]}, %{op: :commit}])
        |> ship("ana", ["a1"])
        |> ship("ana", ["a2"])

      %{game: game, erased: game.main |> Enum.drop(1) |> Enum.map(& &1.id)}
    end

    test "rewinds main to your pointer, pushes yours on top, and takes a sin; erased commits go home",
         %{game: game, erased: erased} do
      [raj_commit] = game.players["raj"].local
      assert Ops.cost(game, "raj", %{op: :force}) == 1
      assert {:ok, game, [forced]} = Ops.run(game, "raj", %{op: :force})

      assert %{
               type: :forced,
               erased: ^erased,
               pushed: [pushed],
               returned: ^erased,
               message: " + " <> _
             } = forced

      assert pushed == raj_commit.id
      assert Enum.map(game.main, & &1.id) |> tl() == [raj_commit.id]
      assert Enum.map(game.players["ana"].local, & &1.id) == erased
      assert game.players["raj"].sins == 1
      assert Game.behind_by(game, "ana") == 1
      assert hand_ids(game, "raj") == ["f2"]
    end

    test "an armed reflog brings every erased commit of its owner's back on top, once", %{
      game: game,
      erased: erased
    } do
      game = play(game, "ana", [%{op: :arm, trap: "reflog"}])

      assert {:ok, game,
              [%{returned: []}, %{type: :reflog_fired, player: "ana", restored: ^erased}]} =
               Ops.run(game, "raj", %{op: :force})

      assert game.main |> Enum.map(& &1.id) |> Enum.take(-2) == erased
      assert game.players["ana"].local == []
      assert game.players["ana"].armed == []
      assert Game.behind_by(game, "ana") == 0
      assert Game.behind_by(game, "raj") == 2
    end

    test "an erased revert is undone: the bug it neutralised counts again", %{rules: rules} do
      game =
        table(rules, %{
          "ana" => [card("a1", "auth.js", 8, true), cmd("bl", "blame"), cmd("v1", "revert")],
          "raj" => [card("r1", "README.md", 2), cmd("f1", "force")]
        })

      game =
        game |> play("raj", [%{op: :add, cards: ["r1"]}, %{op: :commit}]) |> ship("ana", ["a1"])

      bug = tip(game).id
      game = play(game, "ana", [%{op: :blame, target: bug}, %{op: :revert, target: bug}])
      assert game.players["ana"].fixes == 1

      assert {:ok, game, [%{revived: [^bug]}]} = Ops.run(game, "raj", %{op: :force})
      assert game.players["ana"].fixes == 0
      refute Enum.any?(game.main, &(&1[:revert_of] == bug))
    end

    test "an erased commit that was already overwritten stays gone, and its cards leave play", %{
      game: game
    } do
      # found by the resolver's card-conservation property: these cards used to vanish
      [_, crossed | _] = game.main

      game = %{
        game
        | main:
            Enum.map(
              game.main,
              &if(&1.id == crossed.id,
                do: Map.merge(&1, %{overwritten: true, flipped: true}),
                else: &1
              )
            )
      }

      assert {:ok, game, _} = Ops.run(game, "raj", %{op: :force})

      refute Enum.any?(game.main ++ game.players["ana"].local, &(&1.id == crossed.id))
      assert Enum.all?(crossed.cards, &(&1 in game.discard))
    end

    test "with nothing ahead of your pointer it fails, and the card stays", %{game: game} do
      game = play(game, "raj", [%{op: :pull}])

      assert {:failed, ^game, [%{message: "error: nothing ahead of your pointer to overwrite"}]} =
               Ops.run(game, "raj", %{op: :force})

      assert "f1" in hand_ids(game, "raj")
    end
  end

  test "Stack Overflow Is Down: every command fails, is paid for, and keeps its card", %{
    rules: rules
  } do
    sodown = Enum.find(rules.incidents, &(&1.id == "sodown"))
    game = %{table(rules, %{"ana" => [cmd("f1", "force")], "raj" => []}) | incident: sodown}
    assert Ops.cost(game, "ana", %{op: :force}) == 1

    assert {:failed, ^game, [%{message: "error: Stack Overflow Is Down: no command cards today"}]} =
             Ops.run(game, "ana", %{op: :force})
  end
end
