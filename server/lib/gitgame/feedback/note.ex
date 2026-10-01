defmodule GitGame.Feedback.Note do
  @moduledoc "What one player said about one game once it was over (M13b)."
  use Ecto.Schema

  @foreign_key_type :binary_id
  @timestamps_opts [type: :utc_datetime_usec]
  schema "feedback" do
    field :body, :string
    field :game_id, :binary_id
    belongs_to :player, GitGame.Players.Player
    timestamps()
  end
end
