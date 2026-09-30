defmodule GitGame.ReleaseTest do
  use ExUnit.Case, async: true
  alias GitGame.{Game, Ops, Release, Rules}

  setup_all do: %{rules: Rules.load!()}

  defp commit(id, author, lines, extra \\ %{}) do
    Map.merge(
      %{
        id: id,
        author: author,
        cards: [%{id: "k" <> id, kind: :commit, file: "auth.js", lines: lines, bug: false}],
        flipped: false
      },
      extra
    )
  end

  defp bug(id, author, lines, extra \\ %{}) do
    c = commit(id, author, lines, extra)
    %{c | cards: Enum.map(c.cards, &%{&1 | bug: true})}
  end

  # A two-player game whose main we lay out: the release size for two is 10 commits.
  defp game_with(rules, commits) do
    game = Game.new(rules, 7, ["ana", "raj"])
    %{game | main: [hd(game.main) | commits]}
  end

  defp filler(n), do: for(i <- 1..n, do: commit("f#{i}", "raj", 1))

  test "tag before main is the release size fails and costs its op", %{rules: rules} do
    game = game_with(rules, filler(9))
    assert Ops.cost(game, "ana", %{op: :tag}) == 1

    assert {:failed, ^game, [%{message: "error: main has 9 commits; v1.0 needs 10"}]} =
             Ops.run(game, "ana", %{op: :tag})

    one = game_with(rules, filler(1))

    assert {:failed, _, [%{message: "error: main has 1 commit; v1.0 needs 10"}]} =
             Ops.run(one, "ana", %{op: :tag})
  end

  test "tag at the release size runs CI: every commit face-up, unblamed live bugs counted once",
       %{rules: rules} do
    main = [
      bug("b1", "ana", 3),
      bug("b2", "raj", 6, %{flipped: true, blamed: true}),
      bug("b3", "raj", 8, %{flipped: true, reverted: true}),
      bug("b4", "ana", 5, %{overwritten: true, flipped: true}),
      commit("c1", "ana", 4)
    ]

    game = game_with(rules, main ++ filler(5))
    game = put_in(game.players["raj"].blame, 1)

    assert {:ok, game, [%{type: :tagged, player: "ana"}, ci]} = Ops.run(game, "ana", %{op: :tag})
    assert %{type: :ci_ran, by: "ana", bugs: 2, production_down: false} = ci
    assert Enum.all?(tl(game.main), & &1.flipped)

    # b1 is newly caught; b2 was blamed already and isn't counted twice; b3 was reverted; b4 was overwritten
    assert game.players["ana"].blame == 1
    assert game.players["raj"].blame == 1
    assert Enum.map(Enum.filter(ci.flips, & &1.blamed_now), & &1.commit) == ["b1"]
  end

  test "four bugs in production take it down, and the least blame wins", %{rules: rules} do
    main = [
      bug("b1", "ana", 3),
      bug("b2", "ana", 6),
      bug("b3", "ana", 3),
      bug("b4", "raj", 6),
      commit("c1", "ana", 8)
    ]

    {game, ci} = Release.ci(game_with(rules, main ++ filler(5)), nil)

    assert %{by: nil, bugs: 4, production_down: true} = ci
    assert Release.winners(game) == ["raj"]
  end

  test "otherwise the highest total wins; ties share it", %{rules: rules} do
    {game, _} =
      Release.ci(game_with(rules, [commit("a", "ana", 8), commit("r", "raj", 3)]), "ana")

    assert Release.winners(game) == ["ana"]

    {game, _} =
      Release.ci(game_with(rules, [commit("a", "ana", 3), commit("r", "raj", 3)]), "ana")

    assert Release.winners(game) == ["ana", "raj"]
    assert Release.winners(game_with(rules, [])) == []
  end

  test "the live score counts a face-down bug as clean, so it can't give one away", %{
    rules: rules
  } do
    game = game_with(rules, [bug("b1", "ana", 6), commit("c1", "ana", 2)])
    assert Release.scores(game)["ana"].lines == 8

    {released, _} = Release.ci(game, "raj")
    assert Release.scores(released)["ana"].lines == 2
    assert Release.scores(released)["ana"].blame == -3
  end

  test "every token and fix counts at its value in rules/deck.json's scoring", %{rules: rules} do
    game =
      game_with(rules, [
        commit("c1", "ana", 5),
        commit("v1", "ana", 0, %{revert_of: "x", cards: []})
      ])

    ana = %{game.players["ana"] | merge: 2, grudges: 1, sins: 1, fixes: 1, blame: 1}
    game = Game.put_player(game, "ana", ana)

    assert Release.scores(game)["ana"] == %{
             lines: 5,
             fixes: 1,
             blame: -3,
             merge: -2,
             grudges: -1,
             sins: -1,
             total: -1
           }
  end
end
