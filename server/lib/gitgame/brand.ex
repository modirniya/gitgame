defmodule GitGame.Brand do
  @moduledoc """
  The product's name and domain, defined once. The name is not final (`docs/branding.md`), so everything the server
  shows a person reads it from here, and a rename is one edit plus `scripts/brand-audit.sh`.
  """

  # BRAND
  def name, do: "Git Game"
  def domain, do: "gitgame.online"
end
