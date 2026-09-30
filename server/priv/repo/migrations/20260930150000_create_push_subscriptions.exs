defmodule GitGame.Repo.Migrations.CreatePushSubscriptions do
  # ADR-0006: a browser that asked to be reminded. The endpoint is where its push service takes pushes for it; the
  # keys would encrypt a payload, which the first version doesn't send, and are kept for when it does.
  use Ecto.Migration

  def change do
    create table(:push_subscriptions) do
      add :player_id, references(:players, type: :binary_id, on_delete: :delete_all), null: false
      add :endpoint, :text, null: false
      add :p256dh, :string
      add :auth, :string
      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:push_subscriptions, [:endpoint])
    create index(:push_subscriptions, [:player_id])
  end
end
