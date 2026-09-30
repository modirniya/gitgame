defmodule GitGame.Games.ViewTest do
  use ExUnit.Case, async: true
  alias GitGame.{Game, Rules}
  alias GitGame.Games.View

  test "a face-down commit shows what was announced, never whether it is a bug; a flipped one does" do
    game = Game.new(Rules.load!(), 1, ["ana", "raj"])
    card = %{id: "k1", kind: :commit, file: "auth.js", lines: 8, bug: true}

    down = %{
      id: "abc1234",
      author: "raj",
      cards: [card],
      flipped: false,
      message: "feat(auth): tokens"
    }

    game = %{game | main: game.main ++ [down, %{down | id: "def5678", flipped: true}]}

    [_, face_down, face_up] = View.public(%{game: game, version: 1, sent: []}, "g").main

    assert %{
             author: "raj",
             files: ["auth.js"],
             lines: 8,
             message: "feat(auth): tokens",
             flipped: false
           } = face_down

    refute Map.has_key?(face_down, :bug)
    assert %{flipped: true, bug: true} = face_up
  end

  test "hands, staging areas and local branches are counts" do
    game = Game.new(Rules.load!(), 1, ["ana", "raj"])
    view = View.public(%{game: game, version: 1, sent: []}, "g")
    assert view.players["ana"].hand == 5
    refute inspect(view) =~ "\"k"
  end
end
