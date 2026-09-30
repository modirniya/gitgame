defmodule GitGame.Players.Session do
  @moduledoc """
  A signed-in device. The token itself lives only in that device's cookie; this row holds its SHA-256, so a copy of the
  database signs nobody in, and deleting the row signs the device out (ADR-0005).
  """
  use Ecto.Schema

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  @timestamps_opts [type: :utc_datetime_usec, updated_at: false]
  schema "sessions" do
    field :token_hash, :binary
    field :expires_at, :utc_datetime_usec
    belongs_to :player, GitGame.Players.Player
    timestamps()
  end
end
