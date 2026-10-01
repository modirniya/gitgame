defmodule GitGame.Bot.Why do
  @moduledoc """
  The one-line `why` on each op the bot writes (M14b), in one of two voices: `:it`, the bot's own, which everyone at
  the table reads beside its command ("it builds a commit"), and `:you`, for a hint (M15k), the same pack written for
  a person's seat and shown to them ("you build a commit").

  Each why is a fixed sentence with nothing put into it, so it says only what anyone could see: the ops themselves,
  `main`, whether the player was behind. Never a hand, and never whether a face-down commit of one's own is a bug.
  """

  @whys %{
    release: %{
      it: "main is the size of a release, and it isn't behind on points",
      you: "main is the size of a release, and you aren't behind on points"
    },
    force: %{
      it: "someone else's big commit is ahead of it: it overwrites main",
      you: "someone else's big commit is ahead of you: you overwrite main"
    },
    catch_up: %{it: "main has moved: it catches up", you: "main has moved: you catch up"},
    blame: %{
      it: "it blames the biggest face-down commit on main",
      you: "you blame the biggest face-down commit on main"
    },
    revert: %{
      it: "its own bug is face-up on main: it reverts it",
      you: "your own bug is face-up on main: you revert it"
    },
    add: %{it: "it builds a commit", you: "you build a commit"},
    commit: %{it: "it commits what it staged", you: "you commit what you staged"},
    push: %{it: "it ships what it has committed", you: "you ship what you have committed"},
    pull_behind: %{
      it: "main has moved: it pulls before it pushes",
      you: "main has moved: you pull before you push"
    },
    pull: %{
      it: "it pulls first, in case someone pushes before it",
      you: "you pull first, in case someone pushes before you"
    },
    arm: %{it: "a trap, face-down", you: "a trap, face-down"}
  }

  @doc "The sentence for the op `key` names, in `voice` (`:it` or `:you`)."
  def say(key, voice), do: @whys |> Map.fetch!(key) |> Map.fetch!(voice)
end
