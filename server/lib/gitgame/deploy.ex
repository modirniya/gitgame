defmodule GitGame.Deploy do
  @moduledoc """
  What a deploy runs inside a release, where there is no Mix: `bin/migrate` calls `migrate/0` before the new version
  starts serving.
  """

  def migrate do
    Application.load(:gitgame)

    for repo <- Application.fetch_env!(:gitgame, :ecto_repos) do
      {:ok, _, _} = Ecto.Migrator.with_repo(repo, &Ecto.Migrator.run(&1, :up, all: true))
    end
  end
end
