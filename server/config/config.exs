# This file is responsible for configuring your application
# and its dependencies with the aid of the Config module.
#
# This configuration file is loaded before any dependency and
# is restricted to this project.

# General application configuration
import Config

# The rules the game is played by (docs/design/round-resolution.md). A release will need them copied in: see M11.
# Days close on a clock: one Oban job per day, at its deadline (docs/design/phase-1-plan.md, M5).
config :gitgame, Oban, repo: GitGame.Repo, queues: [days: 10, notifications: 5]

# The ways a notification reaches a player (GitGame.Notifications.Channel, ADR-0006).
config :gitgame, notification_channels: []

config :gitgame, rules_dir: Path.expand("../../rules", __DIR__)

# Per hour: new players from one address, and games and rooms made by one player (GitGameWeb.Plugs.RateLimit). A
# classroom behind one address makes a few dozen players; a script makes thousands.
config :gitgame, rate_limits: %{players: 60, games: 120}

config :gitgame,
  namespace: GitGame,
  ecto_repos: [GitGame.Repo],
  generators: [timestamp_type: :utc_datetime, binary_id: true]

# Configure the endpoint
config :gitgame, GitGameWeb.Endpoint,
  url: [host: "localhost"],
  adapter: Bandit.PhoenixAdapter,
  render_errors: [
    formats: [json: GitGameWeb.ErrorJSON],
    layout: false
  ],
  pubsub_server: GitGame.PubSub,
  live_view: [signing_salt: "fNVTW77N"]

# Configure Elixir's Logger
config :logger, :default_formatter,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]

# Use Jason for JSON parsing in Phoenix
config :phoenix, :json_library, Jason

# Import environment specific config. This must remain at the bottom
# of this file so it overrides the configuration defined above.
import_config "#{config_env()}.exs"
