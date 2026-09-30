defmodule GitGame.Games.Event do
  @moduledoc """
  One input in a game's append-only log (ADR-0004): `game_created`, `pack_sent` or `day_closed`, numbered by `seq`
  within its game. The database refuses to update or delete a row.
  """
  use Ecto.Schema

  @primary_key false
  schema "game_events" do
    field :game_id, :binary_id, primary_key: true
    field :seq, :integer, primary_key: true
    field :type, :string
    field :day, :integer
    field :player, :string
    field :payload, :map, default: %{}
    field :inserted_at, :utc_datetime_usec, autogenerate: {DateTime, :utc_now, []}
  end
end
