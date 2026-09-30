defmodule GitGame.Repo.Migrations.CreateBetaMarks do
  # M12, ADR-0002: what the beta records that a game's log can't know. A visit is marked at most once a day per
  # player, a replay once a day per player and game; everything else the report needs is in the logs already.
  use Ecto.Migration

  def change do
    create table(:beta_marks) do
      add :kind, :string, null: false
      add :player_id, references(:players, type: :binary_id, on_delete: :nilify_all)
      add :game_id, references(:games, type: :binary_id, on_delete: :delete_all)
      # the UTC date: what "once a day" counts in
      add :day, :date, null: false
      # where a visit came from: nil for a player who came back by themselves
      add :via, :string
      timestamps(type: :utc_datetime_usec, updated_at: false)
    end

    create unique_index(:beta_marks, [:player_id, :day],
             where: "kind = 'visit'",
             name: :beta_marks_one_visit_a_day
           )

    create unique_index(:beta_marks, [:player_id, :game_id, :day],
             where: "kind = 'replay'",
             name: :beta_marks_one_replay_a_day
           )
  end
end
