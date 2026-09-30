defmodule GitGame.Push.Subscription do
  @moduledoc "A browser that asked to be reminded (ADR-0006): where its push service takes pushes for it."
  use Ecto.Schema

  @foreign_key_type :binary_id
  @timestamps_opts [type: :utc_datetime_usec]
  schema "push_subscriptions" do
    field :endpoint, :string
    field :p256dh, :string
    field :auth, :string
    belongs_to :player, GitGame.Players.Player
    timestamps()
  end
end
