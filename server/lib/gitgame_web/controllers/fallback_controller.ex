defmodule GitGameWeb.FallbackController do
  @moduledoc "Turns the games context's `{:error, reason, message}` into a status and `{\"error\": message}`."
  use GitGameWeb, :controller

  @status %{
    not_found: :not_found,
    stale: :conflict,
    over: :conflict,
    invalid: :unprocessable_entity,
    not_a_player: :forbidden,
    left: :forbidden
  }

  def call(conn, {:error, :not_found}),
    do: call(conn, {:error, :not_found, "fatal: no such game"})

  def call(conn, {:error, reason, message}) do
    conn |> put_status(Map.fetch!(@status, reason)) |> json(%{error: message})
  end
end
