defmodule GitGame.Repo.Migrations.CreateEmailAddresses do
  # ADR-0006: an address a player gave for reminders, and whether they have confirmed it; nothing is sent to it
  # before they have. One a player. `digest` is one email a day instead of one per game.
  use Ecto.Migration

  def change do
    create table(:email_addresses) do
      add :player_id, references(:players, type: :binary_id, on_delete: :delete_all), null: false
      add :address, :string, null: false
      add :confirmed_at, :utc_datetime_usec
      add :digest, :boolean, null: false, default: false
      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:email_addresses, [:player_id])
  end
end
