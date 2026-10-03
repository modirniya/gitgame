import Config

# config/runtime.exs is executed for all environments, including
# during releases. It is executed after compilation and before the
# system starts, so it is typically used to load production configuration
# and secrets from environment variables or elsewhere. Do not define
# any compile-time configuration in here, as it won't be applied.
# The block below contains prod specific runtime configuration.

# ## Using releases
#
# If you use `mix release`, you need to explicitly enable the server
# by passing the PHX_SERVER=true when you start it:
#
#     PHX_SERVER=true bin/gitgame start
#
# Alternatively, you can use `mix phx.gen.release` to generate a `bin/server`
# script that automatically sets the env var above.
if System.get_env("PHX_SERVER") do
  config :gitgame, GitGameWeb.Endpoint, server: true
end

config :gitgame, GitGameWeb.Endpoint,
  http: [port: String.to_integer(System.get_env("PORT", "4000"))]

# Reminders by Web Push (ADR-0006) are on when the deployment's VAPID keys are in the environment
# (`mix gitgame.vapid_keys` makes a pair), and off otherwise.
if public = System.get_env("GITGAME_VAPID_PUBLIC_KEY") do
  config :gitgame, :push,
    public_key: public,
    private_key: System.fetch_env!("GITGAME_VAPID_PRIVATE_KEY"),
    subject: System.get_env("GITGAME_VAPID_SUBJECT", "mailto:hello@gitgame.online")
end

# Reminders by email (ADR-0006) are on when an SMTP relay is in the environment, and off otherwise. The provider is
# whoever runs the relay.
if relay = System.get_env("GITGAME_SMTP_RELAY") do
  config :gitgame, GitGame.Mailer,
    adapter: Swoosh.Adapters.SMTP,
    relay: relay,
    port: String.to_integer(System.get_env("GITGAME_SMTP_PORT", "587")),
    username: System.get_env("GITGAME_SMTP_USERNAME"),
    password: System.get_env("GITGAME_SMTP_PASSWORD"),
    tls: :always,
    auth: :always
end

# Linking GitHub (ADR-0005) is on when the OAuth app's credentials are in the environment, and off otherwise:
# anonymous play needs nothing.
if client_id = System.get_env("GITGAME_GITHUB_CLIENT_ID") do
  config :gitgame, :github,
    client_id: client_id,
    client_secret: System.fetch_env!("GITGAME_GITHUB_CLIENT_SECRET")
end

# The maintainer's pulse at /stats (M13e) is there when its token is in the environment, and isn't otherwise.
if token = System.get_env("STATS_TOKEN") do
  config :gitgame, :stats_token, token
end

if config_env() == :prod do
  # a release carries the rules it was built with, in its priv (the Dockerfile copies rules/ there)
  config :gitgame,
    rules_dir: System.get_env("GITGAME_RULES_DIR") || Application.app_dir(:gitgame, "priv/rules")

  database_url =
    System.get_env("DATABASE_URL") ||
      raise """
      environment variable DATABASE_URL is missing.
      For example: ecto://USER:PASS@HOST/DATABASE
      """

  maybe_ipv6 = if System.get_env("ECTO_IPV6") in ~w(true 1), do: [:inet6], else: []

  config :gitgame, GitGame.Repo,
    # ssl: true,
    url: database_url,
    pool_size: String.to_integer(System.get_env("POOL_SIZE") || "10"),
    # For machines with several cores, consider starting multiple pools of `pool_size`
    # pool_count: 4,
    socket_options: maybe_ipv6

  # The secret key base is used to sign/encrypt cookies and other secrets.
  # A default value is used in config/dev.exs and config/test.exs but you
  # want to use a different value for prod and you most likely don't want
  # to check this value into version control, so we use an environment
  # variable instead.
  secret_key_base =
    System.get_env("SECRET_KEY_BASE") ||
      raise """
      environment variable SECRET_KEY_BASE is missing.
      You can generate one by calling: mix phx.gen.secret
      """

  host = System.get_env("PHX_HOST") || "example.com"

  config :gitgame, :dns_cluster_query, System.get_env("DNS_CLUSTER_QUERY")

  # On Fly.io (ADR-0007), its proxy says who asked in `fly-client-ip`, a header only it sets; anywhere else, no header
  # is trusted for that.
  if System.get_env("FLY_APP_NAME"), do: config(:gitgame, :client_ip_header, "fly-client-ip")

  config :gitgame, GitGameWeb.Endpoint,
    url: [host: host, port: 443, scheme: "https"],
    http: [
      # Enable IPv6 and bind on all interfaces.
      # Set it to  {0, 0, 0, 0, 0, 0, 0, 1} for local network only access.
      # See the documentation on https://bandit.hexdocs.pm/Bandit.html#t:options/0
      # for details about using IPv6 vs IPv4 and loopback vs public addresses.
      ip: {0, 0, 0, 0, 0, 0, 0, 0}
    ],
    secret_key_base: secret_key_base

  # ## SSL Support
  #
  # To get SSL working, you will need to add the `https` key
  # to your endpoint configuration:
  #
  #     config :gitgame, GitGameWeb.Endpoint,
  #       https: [
  #         ...,
  #         port: 443,
  #         cipher_suite: :strong,
  #         keyfile: System.get_env("SOME_APP_SSL_KEY_PATH"),
  #         certfile: System.get_env("SOME_APP_SSL_CERT_PATH")
  #       ]
  #
  # The `cipher_suite` is set to `:strong` to support only the
  # latest and more secure SSL ciphers. This means old browsers
  # and clients may not be supported. You can set it to
  # `:compatible` for wider support.
  #
  # `:keyfile` and `:certfile` expect an absolute path to the key
  # and cert in disk or a relative path inside priv, for example
  # "priv/ssl/server.key". For all supported SSL configuration
  # options, see https://plug.hexdocs.pm/Plug.SSL.html#configure/1
  #
  # We also recommend setting `force_ssl` in your config/prod.exs,
  # ensuring no data is ever sent via http, always redirecting to https:
  #
  #     config :gitgame, GitGameWeb.Endpoint,
  #       force_ssl: [hsts: true]
  #
  # Check `Plug.SSL` for all available options in `force_ssl`.
end
