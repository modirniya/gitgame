defmodule GitGame.Beta.Mark do
  @moduledoc "Something the beta records that a game's log can't know (ADR-0002): a visit, or a replay opened."
  use Ecto.Schema

  @foreign_key_type :binary_id
  @timestamps_opts [type: :utc_datetime_usec, updated_at: false]
  schema "beta_marks" do
    field :kind, :string
    field :day, :date
    field :via, :string
    belongs_to :player, GitGame.Players.Player
    field :game_id, :binary_id
    timestamps()
  end
end
