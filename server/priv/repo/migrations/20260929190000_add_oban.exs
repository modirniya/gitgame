defmodule GitGame.Repo.Migrations.AddOban do
  use Ecto.Migration

  # Oban keeps its jobs in Postgres, beside the games, so a deadline survives a restart like everything else.
  def up, do: Oban.Migration.up()
  def down, do: Oban.Migration.down(version: 1)
end
