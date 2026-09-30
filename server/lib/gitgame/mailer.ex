defmodule GitGame.Mailer do
  @moduledoc """
  Sends email (ADR-0006) through whatever `config :gitgame, GitGame.Mailer` names: SMTP in production, from
  `GITGAME_SMTP_*`, so the provider is configuration; the log in development; Swoosh's test adapter in tests. With no
  adapter, email is off, and nobody is offered it.
  """
  use Swoosh.Mailer, otp_app: :gitgame

  def enabled?, do: Application.get_env(:gitgame, __MODULE__, [])[:adapter] != nil

  @doc "Who emails come from: the game, at its own domain."
  def from, do: {GitGame.Brand.name(), "play@" <> GitGame.Brand.domain()}
end
