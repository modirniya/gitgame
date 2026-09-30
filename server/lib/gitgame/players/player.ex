defmodule GitGame.Players.Player do
  @moduledoc """
  Someone who plays: anonymous, with a generated handle, until they link a GitHub account (ADR-0005). We keep only
  GitHub's public id, login and avatar; no email, and no token that could act on their behalf.
  """
  use Ecto.Schema

  @primary_key {:id, :binary_id, autogenerate: true}
  @timestamps_opts [type: :utc_datetime_usec]
  schema "players" do
    field :handle, :string
    field :github_id, :integer
    field :github_login, :string
    field :avatar_url, :string
    timestamps()
  end

  @doc "A player as the API shows them, to themselves or to anyone at their table."
  def public(%__MODULE__{} = p) do
    %{
      id: p.id,
      handle: p.handle,
      github: p.github_id && %{login: p.github_login, avatar_url: p.avatar_url}
    }
  end
end
