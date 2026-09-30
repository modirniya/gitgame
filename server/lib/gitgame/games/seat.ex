defmodule GitGame.Games.Seat do
  @moduledoc """
  Who holds a seat in a game (ADR-0005). One player holds one seat, or, in a hotseat game, every seat of the people at
  their device. Bots' seats have no row: they are in the game's `bots`.
  """
  use Ecto.Schema

  @primary_key false
  @foreign_key_type :binary_id
  schema "game_seats" do
    field :game_id, :binary_id, primary_key: true
    field :seat, :string, primary_key: true
    belongs_to :player, GitGame.Players.Player
  end
end
