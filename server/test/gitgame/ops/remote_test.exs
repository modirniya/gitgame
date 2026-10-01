defmodule GitGame.Ops.RemoteTest do
  use ExUnit.Case, async: true
  alias GitGame.{Game, Ops, Rules, Seeded}

  setup_all do: %{rules: Rules.load!()}

  defp card(id, file, lines), do: %{id: id, kind: :commit, file: file, lines: lines, bug: false}

  # ana and raj, with hands we choose.
  defp table(rules, ana, raj) do
    game = Game.new(rules, 7, ["ana", "raj"])
    game = Game.put_player(game, "ana", %{game.players["ana"] | hand: ana})
    Game.put_player(game, "raj", %{game.players["raj"] | hand: raj})
  end

  # Runs ops that must succeed; returns the game and every event.
  defp play(game, player, ops) do
    Enum.reduce(ops, {game, []}, fn op, {g, events} ->
      assert {:ok, g, new} = Ops.run(g, player, op)
      {g, events ++ new}
    end)
  end

  defp commit(game, player, card_ids, message \\ ""),
    do:
      play(game, player, [%{op: :add, cards: card_ids}, %{op: :commit, message: message}])
      |> elem(0)

  @merge_failed "Automatic merge failed; fix conflicts and then commit the result."
  @rebased "Successfully rebased and updated refs/heads/main."

  describe "push" do
    test "with nothing to push is free: Everything up-to-date", %{rules: rules} do
      game = table(rules, [], [])
      assert Ops.cost(game, "ana", %{op: :push}) == 0

      assert {:ok, ^game, [%{type: :push_up_to_date, message: "Everything up-to-date"}]} =
               Ops.run(game, "ana", %{op: :push})
    end

    test "from the tip puts your commits on main and moves your pointer", %{rules: rules} do
      game = table(rules, [card("a1", "auth.js", 4)], []) |> commit("ana", ["a1"])
      [mine] = game.players["ana"].local
      assert Ops.cost(game, "ana", %{op: :push}) == 1

      {game, [%{type: :push_accepted, commits: [sha], message: msg}]} =
        play(game, "ana", [%{op: :push}])

      assert sha == mine.id
      assert msg =~ ~r/^   [0-9a-f]{7}\.\.#{sha}  main -> main$/
      assert List.last(game.main).id == sha
      assert game.players["ana"].local == []
      assert Game.behind_by(game, "ana") == 0
      assert Game.behind_by(game, "raj") == 1
    end

    test "from behind is rejected, non-fast-forward, and nothing moves", %{rules: rules} do
      game = table(rules, [card("a1", "auth.js", 4)], [card("r1", "api.py", 3)])
      {game, _} = game |> commit("raj", ["r1"]) |> play("raj", [%{op: :push}])
      game = commit(game, "ana", ["a1"])

      assert Ops.cost(game, "ana", %{op: :push}) == 1

      assert {:failed, ^game,
              [
                %{
                  type: :op_failed,
                  message: "! [rejected]        main -> main (non-fast-forward)"
                }
              ]} = Ops.run(game, "ana", %{op: :push})
    end

    test "under Flaky CI the day's first push rolls the die, and only the first", %{rules: rules} do
      flaky = Enum.find(rules.incidents, &(&1.id == "flaky_ci"))
      roll = fn day -> Seeded.roll(6, 7, {:flaky, day}) end
      bad_day = Enum.find(1..50, &(roll.(&1) <= 2))
      good_day = Enum.find(1..50, &(roll.(&1) > 2))

      ready =
        table(rules, [card("a1", "auth.js", 4), card("a2", "api.py", 2)], [])
        |> commit("ana", ["a1"])

      game = %{ready | incident: flaky, day: bad_day}

      assert {:failed, game, [%{message: "CI failed: flaky build (rolled " <> _}]} =
               Ops.run(game, "ana", %{op: :push})

      assert game.rolled
      assert {:ok, _, [%{type: :push_accepted}]} = Ops.run(game, "ana", %{op: :push})

      assert {:ok, game, [%{type: :push_accepted}]} =
               Ops.run(%{ready | incident: flaky, day: good_day}, "ana", %{op: :push})

      assert game.rolled
    end
  end

  describe "pull" do
    setup %{rules: rules} do
      hands =
        {[card("a1", "auth.js", 4), card("a2", "README.md", 2)],
         [card("r1", "auth.js", 5), card("r2", "api.py", 3)]}

      {game, _} =
        table(rules, elem(hands, 0), elem(hands, 1))
        |> commit("raj", ["r1"])
        |> play("raj", [%{op: :push}])

      %{game: game, theirs: List.last(game.main).id}
    end

    test "when up to date is free: Already up to date.", %{rules: rules} do
      game = table(rules, [], [])
      assert Ops.cost(game, "ana", %{op: :pull}) == 0

      assert {:ok, ^game, [%{type: :pull_up_to_date, message: "Already up to date."}]} =
               Ops.run(game, "ana", %{op: :pull})
    end

    test "with nothing of yours to merge is a fast-forward: 1 op, no merge token", %{
      game: game,
      theirs: theirs
    } do
      assert Ops.cost(game, "ana", %{op: :pull}) == 1
      {game, [pulled]} = play(game, "ana", [%{op: :pull}])

      assert %{type: :pulled, incoming: [^theirs], merge_token: false, message: "Fast-forward"} =
               pulled

      assert Game.behind_by(game, "ana") == 0
      assert game.players["ana"].merge == 0
    end

    test "with an unpushed commit of yours merges it: a merge token", %{game: game} do
      game = commit(game, "ana", ["a2"])

      {game, [%{type: :pulled, merge_token: true, message: "Merge made by the 'ort' strategy."}]} =
        play(game, "ana", [%{op: :pull}])

      assert game.players["ana"].merge == 1
    end

    test "--rebase costs 2 and never takes a merge token", %{game: game} do
      game = commit(game, "ana", ["a2"])
      assert Ops.cost(game, "ana", %{op: :pull, rebase: true}) == 2

      {game, [%{merge_token: false, message: @rebased}]} =
        play(game, "ana", [%{op: :pull, rebase: true}])

      assert game.players["ana"].merge == 0
    end

    test "--rebase with nothing of yours is a fast-forward, as Git does it", %{game: game} do
      assert {:ok, _, [%{message: "Fast-forward"}]} =
               Ops.run(game, "ana", %{op: :pull, rebase: true})
    end

    test "a conflict with -X ours overwrites their commit and takes a grudge", %{
      game: game,
      theirs: theirs
    } do
      game = commit(game, "ana", ["a1"])
      assert Ops.cost(game, "ana", %{op: :pull, strategy: :ours}) == 1

      {game, [detected, resolved, pulled]} = play(game, "ana", [%{op: :pull, strategy: :ours}])

      # Git settles the file itself: no CONFLICT, and a merge
      assert %{type: :conflict_detected, message: "Auto-merging auth.js"} = detected

      assert %{type: :conflict_resolved, strategy: :ours, crossed_out: [^theirs], discarded: []} =
               resolved

      assert %{merge_token: true, message: "Merge made by the 'ort' strategy."} = pulled
      assert %{overwritten: true, flipped: true} = Enum.find(game.main, &(&1.id == theirs))
      assert game.players["ana"].grudges == 1
      assert length(game.players["ana"].local) == 1
    end

    test "a conflict with no strategy declared resolves as theirs: yours is dropped", %{
      game: game
    } do
      game = commit(game, "ana", ["a1"])
      [mine] = game.players["ana"].local

      {game, [detected, resolved, pulled]} = play(game, "ana", [%{op: :pull}])
      assert %{message: "Auto-merging auth.js"} = detected
      assert %{strategy: :theirs, discarded: [id]} = resolved
      assert id == mine.id
      # Git made a merge, but nothing of ana's was left in it: no merge token
      assert %{merge_token: false, message: "Merge made by the 'ort' strategy."} = pulled
      assert game.players["ana"].merge == 0
      assert game.players["ana"].local == []
      assert game.players["ana"].grudges == 0
    end

    test "a conflict resolved by hand keeps both and costs one more op", %{game: game} do
      game = commit(game, "ana", ["a1"])
      assert Ops.cost(game, "ana", %{op: :pull, strategy: :resolve}) == 2
      assert Ops.cost(game, "ana", %{op: :pull, rebase: true, strategy: :resolve}) == 3

      {game, [detected, %{crossed_out: [], discarded: []}, pulled]} =
        play(game, "ana", [%{op: :pull, strategy: :resolve}])

      assert detected.message ==
               "Auto-merging auth.js\nCONFLICT (content): Merge conflict in auth.js\n" <>
                 @merge_failed

      assert %{merge_token: true, message: "Merge made by the 'ort' strategy."} = pulled
      assert length(game.players["ana"].local) == 1
      refute Enum.any?(game.main, & &1[:overwritten])
    end

    test "--rebase -X theirs drops your commit, as patch contents already upstream", %{
      game: game
    } do
      game = commit(game, "ana", ["a1"], "feat(auth): refresh tokens before they expire")
      [mine] = game.players["ana"].local

      {game, [detected, %{discarded: [_]}, pulled]} =
        play(game, "ana", [%{op: :pull, rebase: true, strategy: :theirs}])

      # a rebase settled by -X says nothing of the file
      assert detected.message == ""

      assert pulled.message ==
               "dropping #{mine.id} feat(auth): refresh tokens before they expire" <>
                 " -- patch contents already upstream\n" <> @rebased

      assert %{merge_token: false} = pulled
      assert game.players["ana"].local == []
    end

    test "--rebase -X ours keeps your commit on top", %{game: game} do
      game = commit(game, "ana", ["a1"])

      {game, [%{message: ""}, %{crossed_out: [_]}, %{message: @rebased, merge_token: false}]} =
        play(game, "ana", [%{op: :pull, rebase: true, strategy: :ours}])

      assert game.players["ana"].merge == 0
    end

    test "--rebase resolved by hand stops at each clashing commit; a merge once, every file in path order",
         %{rules: rules} do
      {game, _} =
        table(rules, [card("a1", "auth.js", 4), card("a2", "api.py", 2)], [
          card("r1", "auth.js", 5),
          card("r2", "api.py", 3)
        ])
        |> commit("raj", ["r1", "r2"])
        |> play("raj", [%{op: :push}])

      game =
        game
        |> commit("ana", ["a1"], "feat(auth): rate-limit login attempts")
        |> commit("ana", ["a2"], "feat(api): paginate /users")

      [first, second] = game.players["ana"].local
      stopped_on = &"Auto-merging #{&1}\nCONFLICT (content): Merge conflict in #{&1}\n"

      {_, [detected | _]} = play(game, "ana", [%{op: :pull, rebase: true, strategy: :resolve}])

      assert detected.message ==
               stopped_on.("auth.js") <>
                 "error: could not apply #{first.id}... feat(auth): rate-limit login attempts\n" <>
                 stopped_on.("api.py") <>
                 "error: could not apply #{second.id}... feat(api): paginate /users"

      {_, [detected | _]} = play(game, "ana", [%{op: :pull, strategy: :resolve}])
      assert detected.message == stopped_on.("api.py") <> stopped_on.("auth.js") <> @merge_failed
    end

    test "resolve costs nothing extra when there is no conflict", %{game: game} do
      game = commit(game, "ana", ["a2"])
      assert Ops.cost(game, "ana", %{op: :pull, strategy: :resolve}) == 1
    end
  end
end
