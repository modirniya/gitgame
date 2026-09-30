defmodule GitGame.Games.PackTest do
  use ExUnit.Case, async: true
  alias GitGame.Games.Pack

  test "decodes every op of the online game into the resolver's form" do
    json = %{
      "ops" => [
        %{"op" => "add", "cards" => ["k1", "k2"]},
        %{"op" => "commit", "message" => "fix(auth): session fixation on login"},
        %{"op" => "pull", "rebase" => true, "strategy" => "ours"},
        %{"op" => "push"}
      ],
      "discard" => ["k9"]
    }

    assert {:ok, %{ops: ops, discard: ["k9"]}} = Pack.decode(json, 4)

    assert ops == [
             %{op: :add, cards: ["k1", "k2"]},
             %{op: :commit, message: "fix(auth): session fixation on login"},
             %{op: :pull, rebase: true, strategy: :ours},
             %{op: :push}
           ]

    for {op, expected} <- [
          {%{"op" => "blame", "target" => "abc1234"}, %{op: :blame, target: "abc1234"}},
          {%{"op" => "revert", "target" => "abc1234"}, %{op: :revert, target: "abc1234"}},
          {%{"op" => "force"}, %{op: :force}},
          {%{"op" => "arm", "trap" => "reflog"}, %{op: :arm, trap: "reflog"}},
          {%{"op" => "tag"}, %{op: :tag}},
          {%{"op" => "pull"}, %{op: :pull, rebase: false, strategy: nil}}
        ],
        do: assert({:ok, %{ops: [^expected]}} = Pack.decode(%{"ops" => [op]}, 4))
  end

  test "refuses what isn't a pack, without making atoms from what it was sent" do
    assert {:error, "a pack is an object with an \"ops\" list"} = Pack.decode(%{}, 4)
    assert {:error, "a pack is an object with an \"ops\" list"} = Pack.decode("push", 4)

    assert {:error, "pull: strategy is ours, theirs or resolve"} =
             Pack.decode(%{"ops" => [%{"op" => "pull", "strategy" => "mine"}]}, 4)

    assert {:error, "pull: \"rebase\" is true or false"} =
             Pack.decode(%{"ops" => [%{"op" => "pull", "rebase" => "yes"}]}, 4)

    assert {:error, "\"cards\" is a list of card ids"} =
             Pack.decode(%{"ops" => [%{"op" => "add"}]}, 4)

    assert {:error, "commit: a message is a string of at most 200 bytes"} =
             Pack.decode(
               %{"ops" => [%{"op" => "commit", "message" => String.duplicate("x", 201)}]},
               4
             )

    assert {:error, "git: 'yolo' is not a git command. See 'git --help'."} =
             Pack.decode(%{"ops" => [%{"op" => "yolo"}]}, 4)

    # a real Git command whose card isn't switched on online yet is not "not a git command"
    assert {:error, "fatal: git stash isn't played online yet"} =
             Pack.decode(%{"ops" => [%{"op" => "stash"}]}, 4)

    assert {:error, "each op is an object with an \"op\" name"} = Pack.decode(%{"ops" => [42]}, 4)
  end
end
