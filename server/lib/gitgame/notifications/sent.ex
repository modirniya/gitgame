defmodule GitGame.Notifications.Sent do
  @moduledoc "One notification sent: to whom, about which game and day, what kind, on which channel (ADR-0006)."
  use Ecto.Schema

  @foreign_key_type :binary_id
  @timestamps_opts [type: :utc_datetime_usec, updated_at: false]
  schema "notifications" do
    field :day, :integer
    field :kind, :string
    field :channel, :string
    belongs_to :player, GitGame.Players.Player
    field :game_id, :binary_id
    timestamps()
  end
end
