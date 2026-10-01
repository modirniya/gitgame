defmodule GitGameWeb.FeedbackController do
  @moduledoc "A player's note on a game once it's over (M13b, `GitGame.Feedback`): read back, and left or rewritten."
  use GitGameWeb, :controller
  alias GitGame.Feedback

  action_fallback GitGameWeb.FallbackController

  def show(%{assigns: %{player: nil}}, _params),
    do: {:error, :unauthorized, "fatal: not signed in"}

  def show(conn, %{"id" => id}) do
    note = Feedback.get(conn.assigns.player, id)
    json(conn, %{body: note && note.body, max: Feedback.max_length()})
  end

  def update(%{assigns: %{player: nil}}, _params),
    do: {:error, :unauthorized, "fatal: not signed in"}

  def update(conn, %{"id" => id} = params) do
    with {:ok, note} <- Feedback.put(conn.assigns.player, id, params["body"]),
         do: json(conn, %{body: note.body, max: Feedback.max_length()})
  end
end
