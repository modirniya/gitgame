defmodule Mix.Tasks.Gitgame.BetaReport do
  @shortdoc "Prints the beta's numbers (M12, ADR-0002)"
  @moduledoc """
  Prints what the beta has recorded for the playtest it stands in for: games started and finished, when packs were
  sent against how they went, failed pushes and what followed, absences, replays, and players who came back.

      mix gitgame.beta_report                      # a readable report
      mix gitgame.beta_report --json               # the same numbers, for a script
      mix gitgame.beta_report --since 2026-10-05   # only what happened since then (M13a)
      mix gitgame.beta_report --feedback           # and the notes people left at the end of their games (M13b)

  It reads the database of the environment it runs in (`MIX_ENV`). Inside a release, where there is no Mix,
  `bin/beta_report` takes the same options (`GitGame.Beta.Printout`).
  """
  use Mix.Task
  alias GitGame.Beta.Printout

  @requirements ["app.start"]

  @impl true
  def run(args), do: Mix.shell().info(Printout.run(args))
end
