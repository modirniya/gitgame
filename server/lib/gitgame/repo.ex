defmodule GitGame.Repo do
  use Ecto.Repo,
    otp_app: :gitgame,
    adapter: Ecto.Adapters.Postgres
end
