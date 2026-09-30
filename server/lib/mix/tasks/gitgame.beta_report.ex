defmodule Mix.Tasks.Gitgame.BetaReport do
  @shortdoc "Prints the beta's numbers (M12, ADR-0002)"
  @moduledoc """
  Prints what the beta has recorded for the playtest it stands in for: games started and finished, when packs were
  sent against how they went, failed pushes and what followed, absences, replays, and players who came back.

      mix gitgame.beta_report          # a readable report
      mix gitgame.beta_report --json   # the same numbers, for a script

  It reads the database of the environment it runs in (`MIX_ENV`).
  """
  use Mix.Task
  alias GitGame.Beta.Report

  @requirements ["app.start"]

  @impl true
  def run(args) do
    report = Report.build()

    if "--json" in args,
      do: Mix.shell().info(JSON.encode!(report)),
      else: Mix.shell().info(format(report))
  end

  @doc false
  def format(r) do
    g = r.games
    t = r.send_timing
    f = r.failed_pushes
    a = r.absences

    """
    # beta report

    games           #{g.started} started, #{g.finished} reached a release, #{g.finished_by_people} finished by people#{if g.share, do: " (#{round(g.share * 100)}%; the charter asks >= 50%)", else: ""}

    ## when packs were sent (playtest question 1)
    third of the day   packs   pushed   rejected   no push
    #{for k <- [:first, :middle, :last], do: row(k, t[k])}
    ## after a failed push (question 2)
    #{f.total} failed pushes; next: #{f.pull} pull, #{f.push} push again, #{f.other} something else, #{f.nothing} nothing

    ## absences (question 3)
    #{a.empty_packs} packs never came; #{a.left_the_company} players left the company, in #{a.games_someone_left} games

    ## the exit
    replays         #{r.replays.opened} opened by #{r.replays.players} players; #{r.replays.finished_games_replayed} finished games replayed
    came back       #{r.returning.came_back_another_day} on another day unprompted; #{r.returning.played_again_after_finishing} started a game after finishing one
    """
  end

  defp row(k, c),
    do:
      String.pad_trailing("#{k}", 19) <>
        Enum.map_join(
          [c.packs, c.pushed, c.rejected, c.no_push],
          "",
          &String.pad_leading("#{&1}", 8)
        ) <> "\n"
end
