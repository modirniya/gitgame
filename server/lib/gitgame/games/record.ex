defmodule GitGame.Games.Record do
  @moduledoc "A game's row: what it was created with. Everything that happened since is in `GitGame.Games.Event`."
  use Ecto.Schema

  @primary_key {:id, :binary_id, autogenerate: true}
  @timestamps_opts [type: :utc_datetime_usec]
  schema "games" do
    field :seed, :integer
    field :seats, {:array, :string}
    field :day_length, :string
    field :rules, :map
    field :bots, {:array, :string}, default: []
    timestamps()
  end
end
