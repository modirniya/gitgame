defmodule GitGame.Beta.Printout do
  @moduledoc """
  The beta report (`GitGame.Beta.Report`) as text, or as JSON for a script, from the options a command line gives. It
  is what `mix gitgame.beta_report` prints in development, and what `bin/beta_report` prints inside a release, where
  there is no Mix (M13a):

      --json               the numbers as JSON
      --since 2026-10-05   only games started on or after that day, and the visits and replays marked since
  """
  alias GitGame.Beta.Report

  @doc "The report for `args`, as the text to print. Raises `ArgumentError` on an unknown option or a bad date."
  def run(args) do
    {opts, rest, invalid} = OptionParser.parse(args, strict: [json: :boolean, since: :string])

    if rest != [] or invalid != [],
      do: raise(ArgumentError, "usage: beta_report [--json] [--since YYYY-MM-DD]")

    since = opts[:since] && Date.from_iso8601!(opts[:since])
    report = Report.build(since: since)

    if opts[:json],
      do: JSON.encode!(Map.put(report, :since, since)),
      else: format(report, since)
  end

  @doc "The report as a person reads it."
  def format(r, since \\ nil) do
    g = r.games
    t = r.send_timing
    f = r.failed_pushes
    a = r.absences

    """
    # beta report#{if since, do: ", since #{since}"}

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
