defmodule GitGame.Deploy do
  @moduledoc """
  What runs inside a release, where there is no Mix: `bin/migrate` calls `migrate/0` before a new version starts
  serving, and `bin/beta_report` calls `beta_report/1` to print the beta report from the deployment's database.
  """

  def migrate do
    Application.load(:gitgame)

    for repo <- Application.fetch_env!(:gitgame, :ecto_repos) do
      {:ok, _, _} = Ecto.Migrator.with_repo(repo, &Ecto.Migrator.run(&1, :up, all: true))
    end
  end

  @doc """
  The beta report (`GitGame.Beta.Printout`) for the command line's `args`, read from the database the release points
  at. Only the database is started: not the web server, nor Oban, whose jobs this node must never run.
  """
  def beta_report(args) do
    Application.load(:gitgame)
    [repo] = Application.fetch_env!(:gitgame, :ecto_repos)
    {:ok, text, _} = Ecto.Migrator.with_repo(repo, fn _ -> GitGame.Beta.Printout.run(args) end)
    IO.puts(text)
  end
end
