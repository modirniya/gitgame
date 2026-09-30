defmodule GitGame.Games.Projection do
  @moduledoc """
  The day log as one player may see it (round-resolution §3: "the public day log … bug contents stay hidden unless
  blamed"). The resolver's events are complete and private; before any event leaves the server it goes through
  `event/2` for the player reading it, or `nil` for someone who isn't at the table.

  What others see of your turn is what a table would show: that you drew, staged, committed or discarded, and how
  many cards, but not which; nothing at all of a trap you armed; a failed local op without the message that names
  your cards. Everything that happens on `main` is public: pushes, pulls, conflicts, blame, force-pushes, reflogs
  firing, the tag and CI.
  """

  # Events whose cards belong to one player: others see only how many.
  @counted %{drew: :cards, staged: :cards, hand_limit: :discarded}
  # Ops on your own side of the table: a failure's message would name your cards.
  @local_ops [:add, :commit, :arm]

  @doc "The events `viewer` may see, each as they may see it."
  def events(events, viewer), do: Enum.flat_map(events, &List.wrap(event(&1, viewer)))

  @doc "One event as `viewer` may see it, or `nil` if they may not see it at all."
  def event(%{player: p} = e, viewer) when p == viewer and not is_nil(p), do: e

  def event(%{type: :armed}, _viewer), do: nil
  def event(%{type: :op_failed, op: :arm}, _viewer), do: nil

  def event(%{type: type, player: _} = e, _viewer) when is_map_key(@counted, type) do
    key = @counted[type]
    e |> Map.delete(key) |> Map.put(:count, length(Map.fetch!(e, key)))
  end

  def event(%{type: :committed, player: p, commit: c}, _viewer),
    do: %{type: :committed, player: p, commit: c.id}

  def event(%{type: :op_failed, op: op} = e, _viewer) when op in @local_ops,
    do: Map.delete(e, :message)

  def event(e, _viewer), do: e
end
