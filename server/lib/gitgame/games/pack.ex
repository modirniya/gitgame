defmodule GitGame.Games.Pack do
  @moduledoc """
  A pack as it arrives (JSON: `{"ops": [...], "discard": [card ids]}`) and as the resolver runs it (ops as maps with
  atom keys). `decode/2` is the one door between the two: it accepts only the ops the rules know, in their exact
  shapes, and never turns a string from outside into an atom it doesn't already know, since atoms are never freed.

  The stored form is the validated JSON, so the log holds exactly what the player sent.
  """

  @strategies %{"ours" => :ours, "theirs" => :theirs, "resolve" => :resolve}
  # Real Git commands whose cards are in the tabletop deck but not yet switched on online (rules/online.json).
  @not_online ~w(stash cherry-pick bisect checkout switch amend rebase-i)

  @doc "The resolver's form of a validated pack, or `{:error, message}` in Git's words where Git has them."
  def decode(%{} = json, max_ops) do
    with {:ok, ops} <- list(json, "ops"),
         :ok <- at_most(ops, max_ops),
         {:ok, discard} <- strings(json, "discard", []),
         {:ok, ops} <- all(ops, &op/1) do
      {:ok, %{ops: ops, discard: discard}}
    end
  end

  def decode(_, _), do: {:error, "a pack is an object with an \"ops\" list"}

  defp at_most(ops, max) when length(ops) <= max, do: :ok
  defp at_most(ops, max), do: {:error, "a pack lists at most #{max} ops, not #{length(ops)}"}

  defp op(%{"op" => "add"} = o),
    do: with({:ok, cards} <- strings(o, "cards", nil), do: {:ok, %{op: :add, cards: cards}})

  defp op(%{"op" => "commit"} = o),
    do: with({:ok, msg} <- message(o), do: {:ok, %{op: :commit, message: msg}})

  defp op(%{"op" => "push"}), do: {:ok, %{op: :push}}
  defp op(%{"op" => "force"}), do: {:ok, %{op: :force}}
  defp op(%{"op" => "tag"}), do: {:ok, %{op: :tag}}
  defp op(%{"op" => "arm", "trap" => "reflog"}), do: {:ok, %{op: :arm, trap: "reflog"}}

  defp op(%{"op" => "blame", "target" => t}) when is_binary(t),
    do: {:ok, %{op: :blame, target: t}}

  defp op(%{"op" => "revert", "target" => t}) when is_binary(t),
    do: {:ok, %{op: :revert, target: t}}

  defp op(%{"op" => "pull"} = o) do
    rebase = Map.get(o, "rebase", false)
    strategy = Map.get(o, "strategy")

    cond do
      not is_boolean(rebase) ->
        {:error, "pull: \"rebase\" is true or false"}

      strategy != nil and not Map.has_key?(@strategies, strategy) ->
        {:error, "pull: strategy is ours, theirs or resolve"}

      true ->
        {:ok, %{op: :pull, rebase: rebase, strategy: @strategies[strategy]}}
    end
  end

  defp op(%{"op" => name}) when name in @not_online,
    do: {:error, "fatal: git #{name} isn't played online yet"}

  defp op(%{"op" => name}) when is_binary(name),
    do: {:error, "git: '#{String.slice(name, 0, 40)}' is not a git command. See 'git --help'."}

  defp op(_), do: {:error, "each op is an object with an \"op\" name"}

  defp message(o) do
    case Map.get(o, "message", "") do
      m when is_binary(m) and byte_size(m) <= 200 -> {:ok, m}
      _ -> {:error, "commit: a message is a string of at most 200 bytes"}
    end
  end

  defp list(json, key) do
    case Map.get(json, key) do
      l when is_list(l) -> {:ok, l}
      _ -> {:error, "a pack is an object with an \"#{key}\" list"}
    end
  end

  defp strings(json, key, default) do
    case Map.get(json, key, default) do
      l when is_list(l) and length(l) <= 20 ->
        if Enum.all?(l, &is_binary/1),
          do: {:ok, l},
          else: {:error, "\"#{key}\" is a list of card ids"}

      _ ->
        {:error, "\"#{key}\" is a list of card ids"}
    end
  end

  defp all(items, f) do
    Enum.reduce_while(items, {:ok, []}, fn item, {:ok, acc} ->
      case f.(item) do
        {:ok, x} -> {:cont, {:ok, acc ++ [x]}}
        error -> {:halt, error}
      end
    end)
  end
end
