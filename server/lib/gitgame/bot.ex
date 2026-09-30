defmodule GitGame.Bot do
  @moduledoc """
  A bot player (charter decision 12: bots from day one). It writes a whole day's pack from its own view, what
  `GitGame.Games.View.for_player/3` shows it, never the game's full state, so it knows only what a person in its seat
  would. Its pack is JSON, the same a client sends, and goes through the same door (`GitGame.Games.Pack`).

  The policy is what the prototypes' simulations found plays well under the v0.2 rules:
  - ship what is ready, with a `pull` before every `push`: free if nothing moved, and it keeps a pack from going stale;
  - declare a conflict strategy from the files it can see: drop its own commit if it holds a bug, keep both if the
    budget allows, otherwise keep the bigger;
  - blame the biggest face-down commit of someone else's; revert its own flipped bug from the tip;
  - force-push over even one big commit of someone else's (with batching, waiting to be two behind never comes);
  - tag once `main` is the release size and it is not behind on points;
  - arm a `reflog` whenever it holds one.
  """

  @messages %{
    "auth.js" => [
      "feat(auth): refresh tokens before they expire",
      "fix(auth): session fixation on login",
      "feat(auth): rate-limit login attempts"
    ],
    "api.py" => [
      "feat(api): paginate /users",
      "fix(api): return 404 for a missing org",
      "perf(api): cache the leaderboard query"
    ],
    "styles.css" => [
      "feat(ui): dark mode tokens",
      "fix(ui): visible focus ring on buttons",
      "style(ui): align the card grid"
    ],
    "Dockerfile" => [
      "build: pin the base image",
      "build: multi-stage image",
      "build: run as a non-root user"
    ],
    "README.md" => [
      "docs: local setup",
      "docs: explain the release process",
      "docs: fix the broken badge"
    ]
  }

  @doc "The day's pack for the player whose view this is, as JSON: `%{\"ops\" => [...], \"discard\" => []}`."
  def write_pack(view) do
    me = view.you.player

    s = %{
      view: view,
      me: me,
      you: view.you,
      pub: view.players[me],
      ops: [],
      left: view.budget,
      pulled: false,
      pushing: false
    }

    s
    |> release()
    |> force()
    |> ship()
    |> blame()
    |> revert()
    |> build()
    |> arm()
    |> then(&%{"ops" => &1.ops, "discard" => []})
  end

  # ---------- the policy, in order ----------

  defp release(s) do
    commits = length(s.view.main) - 1
    scores = s.view.scores
    others = for {id, sc} <- scores, id != s.me, do: sc.total

    if commits >= s.view.release_at and scores[s.me].total >= Enum.max(others, fn -> 0 end) do
      s = if s.you.local != [], do: s |> pull() |> push(), else: s
      s |> add(%{"op" => "tag"}, 1) |> Map.put(:done, true)
    else
      s
    end
  end

  defp force(%{done: true} = s), do: s

  defp force(s) do
    ahead =
      s.view.main
      |> Enum.drop(s.pub.pointer)
      |> Enum.filter(&(&1[:author] != s.me and !&1[:revert_of] and !&1[:overwritten]))

    if commands?(s, "force") and s.you.local != [] and s.pub.behind >= 1 and
         Enum.any?(ahead, &(&1.lines >= 4)),
       do: s |> add(%{"op" => "force"}, 1) |> Map.merge(%{pushing: true, forced: true}),
       else: s
  end

  defp ship(%{done: true} = s), do: s
  defp ship(%{forced: true} = s), do: s

  defp ship(s) do
    cond do
      s.you.local != [] -> s |> pull() |> push()
      s.pub.behind > 0 and s.left >= 3 -> pull(s)
      true -> s
    end
  end

  defp blame(%{done: true} = s), do: s

  defp blame(s) do
    target =
      s.view.main
      |> Enum.filter(
        &(&1[:author] not in [nil, s.me] and &1[:flipped] == false and !&1[:overwritten] and
            !&1[:revert_of])
      )
      |> Enum.max_by(& &1.lines, fn -> nil end)

    if (commands?(s, "blame") and target) && target.lines >= 5,
      do: add(s, %{"op" => "blame", "target" => target.id}, 1),
      else: s
  end

  defp revert(%{done: true} = s), do: s

  defp revert(s) do
    own =
      Enum.find(
        s.view.main,
        &(&1[:author] == s.me and &1[:bug] == true and !&1[:reverted] and !&1[:overwritten] and
            !&1[:revert_of])
      )

    at_tip = s.pub.behind == 0 or s.pulled

    if (commands?(s, "revert") and own) && at_tip,
      do: add(s, %{"op" => "revert", "target" => own.id}, 1),
      else: s
  end

  defp build(%{done: true} = s), do: s

  defp build(s) do
    clean =
      s.you.hand
      |> Enum.filter(&(&1.kind == :commit and not &1.bug))
      |> Enum.sort_by(& &1.lines, :desc)

    bugs = s.you.hand |> Enum.filter(&(&1.kind == :commit and &1.bug)) |> Enum.sort_by(& &1.lines)

    pick =
      if clean != [],
        do: Enum.take(clean, if(s.left >= 3 and length(clean) >= 2, do: 2, else: 1)),
        else: Enum.take(bugs, 1)

    s =
      cond do
        s.you.staged != [] ->
          commit(s, s.you.staged)

        pick != [] ->
          s |> add(%{"op" => "add", "cards" => Enum.map(pick, & &1.id)}, 1) |> commit(pick)

        true ->
          s
      end

    # a commit made this morning can go out tonight, if a pull and a push still fit
    if s[:committed] == true and not s.pushing, do: s |> pull() |> push(), else: s
  end

  defp arm(s) do
    if "reflog" not in s.you.armed and Enum.any?(s.you.hand, &(&1[:command] == "reflog")),
      do: add(s, %{"op" => "arm", "trap" => "reflog"}, 0),
      else: s
  end

  # ---------- ops, with what the bot expects each to cost ----------

  defp add(s, op, cost) do
    if length(s.ops) < 4 and cost <= s.left,
      do: %{s | ops: s.ops ++ [op], left: s.left - cost},
      else: s
  end

  defp commit(s, cards) do
    before = length(s.ops)
    s = add(s, %{"op" => "commit", "message" => message(cards)}, 1)
    if length(s.ops) > before, do: Map.put(s, :committed, true), else: s
  end

  defp push(s), do: s |> add(%{"op" => "push"}, 1) |> Map.put(:pushing, true)

  # A pull costs nothing if nothing moved; if the bot is behind it pays for a plain pull, or a rebase when it already
  # holds a merge token and can afford one, and it declares a strategy for any conflict it can see coming.
  defp pull(%{pulled: true} = s), do: s

  defp pull(s) do
    behind = s.pub.behind
    rebase = behind > 0 and s.pub.tokens.merge >= 1 and s.left >= 3
    {strategy, extra} = strategy(s)
    cost = if behind > 0, do: if(rebase, do: 2, else: 1) + extra, else: 0

    op =
      %{"op" => "pull", "rebase" => rebase}
      |> then(&if(strategy, do: Map.put(&1, "strategy", strategy), else: &1))

    before = length(s.ops)
    s = add(s, op, cost)
    if length(s.ops) > before, do: %{s | pulled: true}, else: s
  end

  defp strategy(s) do
    incoming =
      s.view.main
      |> Enum.drop(s.pub.pointer)
      |> Enum.reject(&(&1[:overwritten] || &1[:revert_of]))

    clash =
      for mine <- s.you.local,
          theirs <- incoming,
          files(mine) -- (files(mine) -- theirs.files) != [],
          do: {mine, theirs}

    case clash do
      [] -> {nil, 0}
      [{mine, theirs} | _] -> choose(s, mine, theirs)
    end
  end

  defp choose(s, mine, theirs) do
    cond do
      Enum.any?(mine.cards, & &1.bug) -> {"theirs", 0}
      s.left >= 3 -> {"resolve", 1}
      lines(mine) >= theirs.lines -> {"ours", 0}
      true -> {"theirs", 0}
    end
  end

  defp commands?(s, card),
    do: s.view.commands_allowed and Enum.any?(s.you.hand, &(&1[:command] == card))

  defp files(commit), do: commit.cards |> Enum.map(& &1.file) |> Enum.uniq()
  defp lines(commit), do: commit.cards |> Enum.map(& &1.lines) |> Enum.sum()

  defp message([first | _] = cards) do
    list = Map.fetch!(@messages, first.file)
    Enum.at(list, rem(Enum.sum(Enum.map(cards, & &1.lines)), length(list)))
  end
end
