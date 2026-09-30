defmodule GitGame.Repo.Migrations.CreateRooms do
  # M9: a room gathers a game's players before it starts, since a game's seats are fixed when it is made (ADR-0004).
  use Ecto.Migration

  def change do
    create table(:rooms, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :code, :string, null: false
      add :host_id, references(:players, type: :binary_id, on_delete: :delete_all), null: false
      add :day_length, :string, null: false
      add :bots, :integer, null: false
      add :game_id, references(:games, type: :binary_id, on_delete: :nilify_all)
      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:rooms, [:code])

    create table(:room_members, primary_key: false) do
      add :room_id, references(:rooms, type: :binary_id, on_delete: :delete_all),
        primary_key: true

      add :player_id, references(:players, type: :binary_id, on_delete: :delete_all),
        primary_key: true

      add :joined_at, :utc_datetime_usec, null: false
    end
  end
end
