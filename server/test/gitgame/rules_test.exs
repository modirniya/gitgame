defmodule GitGame.RulesTest do
  use ExUnit.Case, async: true

  alias GitGame.Rules
  alias GitGame.Rules.Invalid

  @dir Application.compile_env!(:gitgame, :rules_dir)
  defp raw(file), do: @dir |> Path.join(file) |> File.read!() |> JSON.decode!()

  describe "the repository's rules" do
    setup do: %{rules: Rules.load!()}

    test "the commit cards are the printed deck: 60 cards, 12 bugs, on tempting sizes", %{
      rules: r
    } do
      assert length(r.commit_cards) == 60
      bugs = for c <- r.commit_cards, c.bug, do: {c.file, c.lines}
      assert length(bugs) == 12

      for file <- r.files do
        # one of the two 3s and the 6 are bugs in every file; auth.js and api.py also have a buggy 8
        expected = if file in ["auth.js", "api.py"], do: [3, 6, 8], else: [3, 6]
        assert Enum.sort(for {^file, n} <- bugs, do: n) == expected
      end
    end

    test "only the command cards switched on for online play are in the game", %{rules: r} do
      assert Map.keys(r.commands) |> Enum.sort() == ~w(blame force reflog revert)
      assert r.commands["force"].count == 5
      assert r.commands["reflog"].cost == 0
    end

    test "the incident pile is the enabled incidents plus the quiet days", %{rules: r} do
      assert Enum.map(r.incidents, & &1.id) ==
               ~w(flaky_ci standup sodown hackathon quiet_tuesday coffee_machine_fixed)

      assert Enum.find(r.incidents, &(&1.id == "standup")).effect == %{kind: :ops, ops: 2}
    end

    test "the v0.2 decisions are what the data says", %{rules: r} do
      assert r.resolution_order == :batch_at_close
      assert r.merge_token_on_plain_pull == :only_when_merging
      assert r.hand_limit == 10
      assert r.release_at == %{2 => 10, 3 => 12, 4 => 15, 5 => 15}
      assert r.day_seconds == %{"correspondence" => 86_400, "lunch" => 300, "live" => 60}
      assert r.scoring.bug_blamed == -3
    end
  end

  describe "a rules file that is wrong fails loudly, naming the key" do
    defp invalid(deck, online),
      do: assert_raise(Invalid, fn -> Rules.from_maps!(deck, online) end).message

    test "a missing key" do
      online = update_in(raw("online.json"), ["day"], &Map.delete(&1, "hand_limit"))
      assert invalid(raw("deck.json"), online) =~ "online.json day: missing hand_limit"
    end

    test "an unknown key, such as a typo" do
      online = update_in(raw("online.json"), ["pack"], &Map.put(&1, "max_opps", 4))
      assert invalid(raw("deck.json"), online) =~ "online.json pack: unknown max_opps"
    end

    test "a value of the wrong kind" do
      online = put_in(raw("online.json"), ["day", "ops_budget"], "3")

      assert invalid(raw("deck.json"), online) =~
               "online.json day.ops_budget: expected a whole number"
    end

    test "a card switched on that the deck doesn't have" do
      online = put_in(raw("online.json"), ["cards", "commands"], ["blame", "git blame"])

      assert invalid(raw("deck.json"), online) =~
               ~s(names "git blame", which deck.json has no card for)
    end

    test "an incident effect the server doesn't know" do
      deck =
        update_in(raw("deck.json"), ["incidents"], fn [i | rest] ->
          [put_in(i, ["effect"], %{"kind" => "chaos"}) | rest]
        end)

      assert invalid(deck, raw("online.json")) =~ "unknown kind"
    end

    test "an incident naming a file that isn't in the deck" do
      deck =
        update_in(raw("deck.json"), ["incidents"], fn incidents ->
          Enum.map(incidents, fn
            %{"id" => "left_pad"} = i -> put_in(i, ["effect", "file"], "Makefile")
            i -> i
          end)
        end)

      assert invalid(deck, raw("online.json")) =~ ~s("Makefile" is not in deck.json files)
    end

    test "a day length that isn't a length" do
      online = put_in(raw("online.json"), ["day", "lengths", "live"], "a minute")
      assert invalid(raw("deck.json"), online) =~ "online.json day.lengths.live"
    end

    test "a resolution order the server doesn't have" do
      online = put_in(raw("online.json"), ["resolution", "order"], "alphabetical")

      assert invalid(raw("deck.json"), online) =~
               ~s("alphabetical" is not one of arrival, batch_at_close)
    end
  end
end
