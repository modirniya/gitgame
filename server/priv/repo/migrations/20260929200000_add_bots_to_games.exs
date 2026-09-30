defmodule GitGame.Repo.Migrations.AddBotsToGames do
  use Ecto.Migration

  # The seats a bot plays (charter decision 12). A bot sends its pack the moment each day opens.
  def change do
    alter table(:games) do
      add :bots, {:array, :string}, null: false, default: []
    end
  end
end
