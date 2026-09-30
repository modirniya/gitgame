defmodule GitGame.Repo.Migrations.CreateNotifications do
  # ADR-0006: what was sent to whom, for which game and day, on which channel. The unique index is the rule "at most
  # once per game a day on each channel", kept by the database however many jobs run.
  use Ecto.Migration

  def change do
    create table(:notifications) do
      add :player_id, references(:players, type: :binary_id, on_delete: :delete_all), null: false
      add :game_id, references(:games, type: :binary_id, on_delete: :delete_all), null: false
      add :day, :integer, null: false
      add :kind, :string, null: false
      add :channel, :string, null: false
      timestamps(type: :utc_datetime_usec, updated_at: false)
    end

    create unique_index(:notifications, [:player_id, :game_id, :day, :kind, :channel])
  end
end
