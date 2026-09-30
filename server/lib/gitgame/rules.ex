defmodule GitGame.Rules do
  @moduledoc """
  The rules of the online game, read from `rules/deck.json` (the cards, shared with the tabletop game) and
  `rules/online.json` (days, packs, resolution). Nothing in the server hard-codes a number these files hold, so a
  playtest tweak is a data change, not a code change.

  Loading validates both files and raises `GitGame.Rules.Invalid`, naming the file and the key, on anything missing,
  unknown or of the wrong kind: a typo in a rules file must never become a silent default.
  """

  defmodule Invalid do
    defexception [:message]
  end

  @enforce_keys [
    :version,
    :files,
    :commit_cards,
    :commands,
    :incidents,
    :starting_hand,
    :draw,
    :ops_budget,
    :hand_limit,
    :release_at,
    :production_down_at,
    :scoring,
    :day_seconds,
    :final_day,
    :closes_early,
    :pack_max_ops,
    :pack_replaceable,
    :failed_op_costs,
    :failed_card_stays,
    :resolution_order,
    :default_conflict_strategy,
    :op_costs,
    :merge_token_on_plain_pull,
    :merge_token_on_rebase,
    :empty_pack_on_absence,
    :left_after_empty_days
  ]
  defstruct @enforce_keys

  @op_costs ~w(add commit push push_with_nothing_to_push pull pull_when_up_to_date pull_rebase resolve_by_hand_extra tag arm_trap)a
  @effects %{
    "ops" => {:ops, [ops: :int]},
    "flaky_first_push" => {:flaky_first_push, [die: :int, rejected_at_or_below: :int]},
    "no_commands" => {:no_commands, []},
    "no_push" => {:no_push, []},
    "must_push" => {:must_push, [ops_lost_next_day: :int]},
    "file_becomes_bug" => {:file_becomes_bug, [file: :string]},
    "each_flips_one_not_their_own" => {:each_flips_one_not_their_own, []}
  }

  @doc "Reads and validates the rules in `dir`, by default the repository's `rules/`."
  def load!(dir \\ Application.fetch_env!(:gitgame, :rules_dir)) do
    from_maps!(read!(Path.join(dir, "deck.json")), read!(Path.join(dir, "online.json")))
  end

  defp read!(path) do
    path |> File.read!() |> JSON.decode!()
  rescue
    e in [File.Error, JSON.DecodeError] -> raise Invalid, "#{path}: #{Exception.message(e)}"
  end

  @doc "Builds the rules from the two decoded files; `load!/1` without the disk, for tests."
  def from_maps!(deck, online) do
    deck =
      fields!(
        deck,
        "deck.json",
        ~w(brand version notes files commit_cards command_cards incidents tickets roles setup scoring tokens)
      )

    online =
      fields!(
        online,
        "online.json",
        ~w(version notes cards day pack resolution op_costs merge_token absence)
      )

    files =
      Enum.map(
        list!(deck, "files", "deck.json"),
        &str!(fields!(&1, "deck.json files[]", ~w(name color)), "name", "deck.json files[]")
      )

    setup =
      fields!(
        deck["setup"],
        "deck.json setup",
        ~w(starting_hand draw_per_turn ops_per_turn hand_limit release_at_commits production_down_at_bugs)
      )

    cards = fields!(online["cards"], "online.json cards", ~w(note commands incidents quiet_days))

    day =
      fields!(
        online["day"],
        "online.json day",
        ~w(lengths final_day draw ops_budget hand_limit closes_early_when_all_packs_are_in)
      )

    pack =
      fields!(
        online["pack"],
        "online.json pack",
        ~w(max_ops replaceable_until_the_day_closes failed_op_costs_its_ops failed_command_card_stays_in_hand)
      )

    resolution =
      fields!(
        online["resolution"],
        "online.json resolution",
        ~w(order order_options default_conflict_strategy)
      )

    merge = fields!(online["merge_token"], "online.json merge_token", ~w(on_plain_pull on_rebase))

    absence =
      fields!(
        online["absence"],
        "online.json absence",
        ~w(empty_pack_when_nothing_arrives left_the_company_after_consecutive_empty_days)
      )

    day_seconds =
      Map.new(map!(day, "lengths", "online.json day"), fn {name, len} ->
        {name, seconds!(len, "online.json day.lengths.#{name}")}
      end)

    final_day = map!(day, "final_day", "online.json day")

    unless Map.keys(final_day) |> Enum.sort() == Map.keys(day_seconds) |> Enum.sort(),
      do:
        raise(Invalid, "online.json day.final_day must name the same day lengths as day.lengths")

    %__MODULE__{
      version: %{
        deck: str!(deck, "version", "deck.json"),
        online: str!(online, "version", "online.json")
      },
      files: files,
      commit_cards: commit_cards!(deck["commit_cards"], files),
      commands: commands!(deck["command_cards"], list!(cards, "commands", "online.json cards")),
      incidents: incidents!(deck["incidents"], cards, files),
      starting_hand: int!(setup, "starting_hand", "deck.json setup"),
      draw: int!(day, "draw", "online.json day"),
      ops_budget: int!(day, "ops_budget", "online.json day"),
      hand_limit: int!(day, "hand_limit", "online.json day"),
      release_at:
        Map.new(map!(setup, "release_at_commits", "deck.json setup"), fn {n, at} ->
          {String.to_integer(n), at}
        end),
      production_down_at: int!(setup, "production_down_at_bugs", "deck.json setup"),
      scoring: scoring!(deck["scoring"]),
      day_seconds: day_seconds,
      final_day:
        Map.new(final_day, fn {name, _} ->
          {name, int!(final_day, name, "online.json day.final_day")}
        end),
      closes_early: bool!(day, "closes_early_when_all_packs_are_in", "online.json day"),
      pack_max_ops: int!(pack, "max_ops", "online.json pack"),
      pack_replaceable: bool!(pack, "replaceable_until_the_day_closes", "online.json pack"),
      failed_op_costs: bool!(pack, "failed_op_costs_its_ops", "online.json pack"),
      failed_card_stays: bool!(pack, "failed_command_card_stays_in_hand", "online.json pack"),
      resolution_order:
        one_of!(
          resolution,
          "order",
          %{"batch_at_close" => :batch_at_close, "arrival" => :arrival},
          "online.json resolution"
        ),
      default_conflict_strategy:
        one_of!(
          resolution,
          "default_conflict_strategy",
          %{"ours" => :ours, "theirs" => :theirs},
          "online.json resolution"
        ),
      op_costs: op_costs!(online["op_costs"]),
      merge_token_on_plain_pull:
        one_of!(
          merge,
          "on_plain_pull",
          %{"only_when_merging_unpushed_commits" => :only_when_merging, "always" => :always},
          "online.json merge_token"
        ),
      merge_token_on_rebase: bool!(merge, "on_rebase", "online.json merge_token"),
      empty_pack_on_absence:
        bool!(absence, "empty_pack_when_nothing_arrives", "online.json absence"),
      left_after_empty_days:
        int!(absence, "left_the_company_after_consecutive_empty_days", "online.json absence")
    }
  end

  # The printed deck: every file in every size of `lines_per_file`; a card is a bug if its size is still owed to that
  # file's bug list (`every_file` plus any `extra` for it), so a file with two 3s has exactly one buggy 3.
  defp commit_cards!(spec, files) do
    spec = fields!(spec, "deck.json commit_cards", ~w(lines_per_file bugs note))
    sizes = list!(spec, "lines_per_file", "deck.json commit_cards")
    bugs = fields!(spec["bugs"], "deck.json commit_cards.bugs", ~w(every_file extra))
    every_file = list!(bugs, "every_file", "deck.json commit_cards.bugs")

    for file <- files, reduce: [] do
      acc ->
        extra =
          for e <- list!(bugs, "extra", "deck.json commit_cards.bugs"),
              e["file"] == file,
              do: e["lines"]

        {cards, _} =
          Enum.map_reduce(sizes, every_file ++ extra, fn n, owed ->
            {%{file: file, lines: n, bug: n in owed}, List.delete(owed, n)}
          end)

        acc ++ cards
    end
  end

  defp commands!(deck_cards, enabled) do
    all =
      Map.new(deck_cards, fn c ->
        c = fields!(c, "deck.json command_cards[]", ~w(id name count cost text))

        {c["id"],
         %{
           name: c["name"],
           count: int!(c, "count", "deck.json #{c["id"]}"),
           cost: int!(c, "cost", "deck.json #{c["id"]}")
         }}
      end)

    for id <- enabled, into: %{} do
      {id,
       Map.get(all, id) ||
         raise(
           Invalid,
           "online.json cards.commands names #{inspect(id)}, which deck.json has no card for"
         )}
    end
  end

  defp incidents!(deck_incidents, cards, files) do
    all =
      Map.new(deck_incidents, fn i ->
        i = fields!(i, "deck.json incidents[]", ~w(id name text effect))

        {i["id"],
         %{
           id: i["id"],
           name: i["name"],
           text: i["text"],
           effect: effect!(i["effect"], i["id"], files)
         }}
      end)

    enabled =
      for id <- list!(cards, "incidents", "online.json cards"),
          do:
            Map.get(all, id) ||
              raise(
                Invalid,
                "online.json cards.incidents names #{inspect(id)}, which deck.json has no incident for"
              )

    quiet =
      for q <- list!(cards, "quiet_days", "online.json cards") do
        q = fields!(q, "online.json cards.quiet_days[]", ~w(id name text))
        %{id: q["id"], name: q["name"], text: q["text"], effect: %{kind: :none}}
      end

    enabled ++ quiet
  end

  defp effect!(effect, id, files) do
    path = "deck.json incidents.#{id}.effect"

    {kind, params} =
      Map.get(@effects, is_map(effect) && effect["kind"]) ||
        raise(Invalid, "#{path}: unknown kind #{inspect(effect)}")

    effect =
      fields!(effect, path, ["kind" | Enum.map(params, fn {k, _} -> Atom.to_string(k) end)])

    for {key, type} <- params, into: %{kind: kind} do
      value =
        if type == :int,
          do: int!(effect, Atom.to_string(key), path),
          else: str!(effect, Atom.to_string(key), path)

      if key == :file and value not in files,
        do: raise(Invalid, "#{path}.file: #{inspect(value)} is not in deck.json files")

      {key, value}
    end
  end

  defp scoring!(spec) do
    spec =
      fields!(
        spec,
        "deck.json scoring",
        ~w(note bug_blamed merge_token grudge_token sin_token revert_played)
      )

    for k <- ~w(bug_blamed merge_token grudge_token sin_token revert_played)a,
        into: %{},
        do: {k, signed_int!(spec, Atom.to_string(k), "deck.json scoring")}
  end

  defp op_costs!(spec) do
    spec = fields!(spec, "online.json op_costs", Enum.map(@op_costs, &Atom.to_string/1))
    for k <- @op_costs, into: %{}, do: {k, int!(spec, Atom.to_string(k), "online.json op_costs")}
  end

  # "24h", "5m", "60s" → seconds
  defp seconds!(len, path) do
    case Integer.parse(to_string(len)) do
      {n, "h"} when n > 0 -> n * 3600
      {n, "m"} when n > 0 -> n * 60
      {n, "s"} when n > 0 -> n
      _ -> raise Invalid, "#{path}: #{inspect(len)} is not a length like 24h, 5m or 60s"
    end
  end

  # ---------- validation: every key present, no key unknown, every value of the right kind ----------

  defp fields!(map, path, keys) when is_map(map) do
    missing = keys -- Map.keys(map)
    unknown = Map.keys(map) -- keys
    if missing != [], do: raise(Invalid, "#{path}: missing #{Enum.join(missing, ", ")}")
    if unknown != [], do: raise(Invalid, "#{path}: unknown #{Enum.join(unknown, ", ")}")
    map
  end

  defp fields!(other, path, _),
    do: raise(Invalid, "#{path}: expected an object, got #{inspect(other)}")

  defp int!(map, key, path),
    do: typed!(map, key, path, &(is_integer(&1) and &1 >= 0), "a whole number")

  defp signed_int!(map, key, path), do: typed!(map, key, path, &is_integer/1, "a whole number")
  defp str!(map, key, path), do: typed!(map, key, path, &is_binary/1, "a string")
  defp bool!(map, key, path), do: typed!(map, key, path, &is_boolean/1, "true or false")
  defp list!(map, key, path), do: typed!(map, key, path, &is_list/1, "a list")
  defp map!(map, key, path), do: typed!(map, key, path, &is_map/1, "an object")

  defp one_of!(map, key, allowed, path) do
    value = str!(map, key, path)

    Map.get(allowed, value) ||
      raise(
        Invalid,
        "#{path}.#{key}: #{inspect(value)} is not one of #{allowed |> Map.keys() |> Enum.join(", ")}"
      )
  end

  defp typed!(map, key, path, ok?, kind) do
    value = Map.get(map, key)

    if ok?.(value),
      do: value,
      else: raise(Invalid, "#{path}.#{key}: expected #{kind}, got #{inspect(value)}")
  end
end
