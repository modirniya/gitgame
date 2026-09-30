defmodule GitGame.Repo.Migrations.CreatePlayersAndSessions do
  # ADR-0005: a player is a row, anonymous until linked to GitHub; a session is the hash of a random token, so the
  # database never holds anything that signs anyone in.
  use Ecto.Migration

  def change do
    create table(:players, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :handle, :string, null: false
      add :github_id, :bigint
      add :github_login, :string
      add :avatar_url, :string
      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:players, [:handle])
    create unique_index(:players, [:github_id])

    create table(:sessions, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :token_hash, :binary, null: false

      add :player_id, references(:players, type: :binary_id, on_delete: :delete_all), null: false

      add :expires_at, :utc_datetime_usec, null: false
      timestamps(type: :utc_datetime_usec, updated_at: false)
    end

    create unique_index(:sessions, [:token_hash])
    create index(:sessions, [:player_id])
  end
end
