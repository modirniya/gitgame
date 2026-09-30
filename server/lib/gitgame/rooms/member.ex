defmodule GitGame.Rooms.Member do
  @moduledoc "Someone who has joined a room; the order they joined in is the order of their seats."
  use Ecto.Schema

  @primary_key false
  @foreign_key_type :binary_id
  schema "room_members" do
    belongs_to :room, GitGame.Rooms.Room, primary_key: true
    belongs_to :player, GitGame.Players.Player, primary_key: true
    field :joined_at, :utc_datetime_usec
  end
end
