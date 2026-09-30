defmodule GitGame.Email.Address do
  @moduledoc "An address a player gave for reminders (ADR-0006), confirmed or not yet, and whether they want a digest."
  use Ecto.Schema

  @foreign_key_type :binary_id
  @timestamps_opts [type: :utc_datetime_usec]
  schema "email_addresses" do
    field :address, :string
    field :confirmed_at, :utc_datetime_usec
    field :digest, :boolean, default: false
    belongs_to :player, GitGame.Players.Player
    timestamps()
  end
end
