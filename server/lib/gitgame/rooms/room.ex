defmodule GitGame.Rooms.Room do
  @moduledoc "A room (M9): its invite code, its host, the game it will start, and that game once started."
  use Ecto.Schema

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  @timestamps_opts [type: :utc_datetime_usec]
  schema "rooms" do
    field :code, :string
    field :day_length, :string
    field :bots, :integer
    field :game_id, :binary_id
    belongs_to :host, GitGame.Players.Player
    has_many :members, GitGame.Rooms.Member, preload_order: [asc: :joined_at]
    timestamps()
  end
end
