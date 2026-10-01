defmodule GitGame.Repo.Migrations.CreateFeedback do
  # M13b: what a player says about a game once it's over, from its scoreboard. One note per player and game, which
  # they may rewrite; the maintainer reads them through the beta report.
  use Ecto.Migration

  def change do
    create table(:feedback) do
      add :player_id, references(:players, type: :binary_id, on_delete: :delete_all), null: false
      add :game_id, references(:games, type: :binary_id, on_delete: :delete_all), null: false
      add :body, :text, null: false
      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:feedback, [:player_id, :game_id])
  end
end
