defmodule GitGame.Repo.Migrations.CreateGamesAndEvents do
  use Ecto.Migration

  # A game is its row (seed, seats, day length, the rules it was created with) and its append-only log of inputs:
  # game_created, pack_sent, day_closed (ADR-0004). State is never stored; it is folded from the log.
  def change do
    create table(:games, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :seed, :bigint, null: false
      add :seats, {:array, :string}, null: false
      add :day_length, :string, null: false
      add :rules, :map, null: false
      timestamps(type: :utc_datetime_usec)
    end

    create table(:game_events, primary_key: false) do
      add :game_id, references(:games, type: :binary_id, on_delete: :nothing), primary_key: true
      add :seq, :integer, primary_key: true
      add :type, :string, null: false
      add :day, :integer, null: false
      add :player, :string
      add :payload, :map, null: false, default: %{}
      add :inserted_at, :utc_datetime_usec, null: false
    end

    # A day closes once, however many jobs or requests race to close it.
    create unique_index(:game_events, [:game_id, :day],
             where: "type = 'day_closed'",
             name: :game_events_one_close_per_day
           )

    # Append-only is enforced by the database, not by convention: history is immutable (charter decision 6).
    execute(
      """
      CREATE FUNCTION game_events_append_only() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'game_events is append-only';
      END;
      $$ LANGUAGE plpgsql
      """,
      "DROP FUNCTION game_events_append_only()"
    )

    execute(
      "CREATE TRIGGER game_events_append_only BEFORE UPDATE OR DELETE ON game_events FOR EACH ROW EXECUTE FUNCTION game_events_append_only()",
      "DROP TRIGGER game_events_append_only ON game_events"
    )
  end
end
