defmodule GitGame.Repo.Migrations.CreateGameSeats do
  # ADR-0005: a game's seats belong to players. The log keeps naming seats, never players, so a seat's name is fixed
  # when the game is made; this table says who holds it. Bots hold no row. A player who is deleted leaves their seat
  # held by nobody, and its commits in the log as they were.
  use Ecto.Migration

  def change do
    create table(:game_seats, primary_key: false) do
      add :game_id, references(:games, type: :binary_id, on_delete: :delete_all),
        primary_key: true

      add :seat, :string, primary_key: true
      add :player_id, references(:players, type: :binary_id, on_delete: :nilify_all)
    end

    create index(:game_seats, [:player_id])
  end
end
