import Config

# Configure your database
#
# The MIX_TEST_PARTITION environment variable can be used
# to provide built-in test partitioning in CI environment.
# Run `mix help test` for more information.
config :gitgame, GitGame.Repo,
  # The standard libpq variables, so CI can say postgres/postgres while a local Homebrew Postgres, which lets the
  # OS user in without a password, needs nothing set at all.
  username: System.get_env("PGUSER") || System.get_env("USER"),
  password: System.get_env("PGPASSWORD", "postgres"),
  hostname: System.get_env("PGHOST", "localhost"),
  database: "gitgame_test#{System.get_env("MIX_TEST_PARTITION")}",
  pool: Ecto.Adapters.SQL.Sandbox,
  pool_size: System.schedulers_online() * 2

# We don't run a server during test. If one is required,
# you can enable the server option below.
config :gitgame, GitGameWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4002],
  secret_key_base: "XwIJIPBYDPfucYmsLqG6PXO3ck2DToqWLUiC1WwOGYJx8PtbCeoOuJn7EOGy8RJa",
  server: false

# Print only warnings and errors during test
config :logger, level: :warning

# Initialize plugs at runtime for faster test compilation
config :phoenix, :plug_init_mode, :runtime

# Sort query params output of verified routes for robust url comparisons
config :phoenix,
  sort_verified_routes_query_params: true

# Jobs run only when a test drains the queue: the tests are the clock.
config :gitgame, Oban, testing: :manual
