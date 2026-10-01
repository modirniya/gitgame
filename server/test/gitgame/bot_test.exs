defmodule GitGame.BotTest do
  use ExUnit.Case, async: true
  alias GitGame.{Bot, Game, Release, Resolver, Rules}
  alias GitGame.Games.{Pack, View}

  @rules Rules.load!()

  defp card(id, file, lines, bug \\ false),
    do: %{id: id, kind: :commit, file: file, lines: lines, bug: bug}

  defp cmd(id, command), do: %{id: id, kind: :command, command: command}

  defp commit(id, author, cards),
    do: %{id: id, author: author, cards: cards, flipped: false, message: ""}

  # A day-1 game on a quiet day with the given hands and main, as the bot "bot" sees it.
  defp view(opts) do
    game = Game.new(@rules, 3, ["ana", "bot"])
    {game, opened} = Resolver.open_day(game)
    game = %{game | incident: Enum.find(@rules.incidents, &(&1.id == "quiet_tuesday"))}
    game = %{game | main: game.main ++ Keyword.get(opts, :main, [])}

    bot = %{
      game.players["bot"]
      | hand: Keyword.get(opts, :hand, []),
        local: Keyword.get(opts, :local, []),
        pointer: Keyword.get(opts, :pointer, length(game.main))
    }

    game = Game.put_player(game, "bot", bot)
    View.for_player(%{game: game, version: 1, days: [], opened: opened, sent: []}, "g", "bot")
  end

  defp ops(pack), do: Enum.map(pack["ops"], & &1["op"])

  test "ships what is ready with a pull before the push; the pull is free, so the next commit fits too" do
    pack =
      Bot.write_pack(
        view(
          hand: [card("c1", "api.py", 5)],
          local: [commit("x1", "bot", [card("c0", "auth.js", 4)])]
        )
      )

    assert ops(pack) == ["pull", "push", "add", "commit"]
    assert {:ok, _} = Pack.decode(pack, 4)
  end

  test "force-pushes over a single big commit of someone else's (the v0.2 finding)" do
    theirs = commit("t1", "ana", [card("a1", "auth.js", 6)])

    pack =
      Bot.write_pack(
        view(
          hand: [cmd("f1", "force")],
          local: [commit("x1", "bot", [card("c0", "README.md", 2)])],
          main: [theirs],
          pointer: 1
        )
      )

    assert hd(ops(pack)) == "force"
  end

  test "declares -X theirs when its own clashing commit holds a bug" do
    theirs = commit("t1", "ana", [card("a1", "auth.js", 2)])
    mine = commit("x1", "bot", [card("c0", "auth.js", 7, true)])
    pack = Bot.write_pack(view(local: [mine], main: [theirs], pointer: 1))
    assert %{"op" => "pull", "strategy" => "theirs"} = hd(pack["ops"])
  end

  test "blames the biggest face-down commit of someone else's" do
    main = [
      commit("t1", "ana", [card("a1", "auth.js", 3)]),
      commit("t2", "ana", [card("a2", "api.py", 7)])
    ]

    pack = Bot.write_pack(view(hand: [cmd("b1", "blame")], main: main, pointer: 3))
    assert Enum.any?(pack["ops"], &match?(%{"op" => "blame", "target" => "t2"}, &1))
  end

  test "never blames a commit its own force-push erases in the same pack" do
    erased = commit("t2", "ana", [card("a2", "api.py", 7)])
    pack = fn main -> Bot.write_pack(view(forcing_blamer(main, erased))) end

    assert ops(pack.([])) == ["force", "add", "commit"]

    # a face-down commit the force-push keeps is still fair game
    kept = commit("t1", "ana", [card("a1", "auth.js", 5)])
    assert %{"op" => "blame", "target" => "t1"} = Enum.at(pack.([kept])["ops"], 1)
  end

  defp forcing_blamer(kept, erased) do
    [
      hand: [cmd("f1", "force"), cmd("b1", "blame"), card("c1", "styles.css", 3)],
      local: [commit("x1", "bot", [card("c0", "README.md", 2)])],
      main: kept ++ [erased],
      pointer: 1 + length(kept)
    ]
  end

  test "arms a reflog it holds, for free" do
    pack = Bot.write_pack(view(hand: [cmd("r1", "reflog")]))
    assert %{"op" => "arm", "trap" => "reflog"} = List.last(pack["ops"])
  end

  test "every op says why, in a sentence that names nothing only the bot can see (M14b)" do
    whys =
      for seed <- 1..100,
          view <- play_views(seed),
          voice <- [:it, :you],
          op <- Bot.write_pack(view, voice: voice)["ops"],
          reduce: MapSet.new() do
        whys ->
          assert is_binary(op["why"]), "#{inspect(op)} says nothing"
          MapSet.put(whys, op["why"])
      end

    # a handful of fixed sentences in each voice, nothing put into them: so no card, file or bug can be in one
    assert MapSet.size(whys) in 10..22
    for why <- whys, do: refute(why =~ ~r/\.(js|py|css|md)|Dockerfile|bug in|clean/)
  end

  test "in your voice, for a hint (M15k), the pack is the same and only its whys are about you" do
    for seed <- 1..100, view <- play_views(seed) do
      its = Bot.write_pack(view)["ops"]
      yours = Bot.write_pack(view, voice: :you)["ops"]
      assert Enum.map(yours, &Map.delete(&1, "why")) == Enum.map(its, &Map.delete(&1, "why"))

      # a why about no one ("a trap, face-down") reads the same in both voices
      for {it, you} <- Enum.zip(its, yours) do
        assert you["why"] =~ ~r/\byour?\b/ or
                 (you["why"] == it["why"] and not (it["why"] =~ ~r/\bits?\b/))
      end
    end
  end

  # the bot's view on each day of one game against the chaos player
  defp play_views(seed) do
    game = Game.new(@rules, seed, ["p1", "p2"])
    {game, _} = Resolver.open_day(game)
    collect(game, :rand.seed_s(:exsss, seed), [])
  end

  defp collect(%Game{released: r}, _rand, views) when r != nil, do: views

  defp collect(game, rand, views) do
    {chaos, rand} = GitGame.Chaos.packs(game, rand)
    view = View.for_player(%{game: game, version: 1, days: [], opened: [], sent: []}, "g", "p1")
    {:ok, pack} = Pack.decode(Bot.write_pack(view), 4)

    {game, _} =
      Resolver.close_day(game, [{"p1", pack} | Enum.reject(chaos, &(elem(&1, 0) == "p1"))])

    collect(game, rand, views ++ [view])
  end

  # Bots against each other and against the chaos player, without the database: the same views, the same door.
  defp play(seed, bots) do
    game = Game.new(@rules, seed, ["p1", "p2"])
    {game, _} = Resolver.open_day(game)
    play(game, bots, :rand.seed_s(:exsss, seed))
  end

  defp play(%Game{released: r} = game, _bots, _rand) when r != nil, do: game

  defp play(game, bots, rand) do
    {chaos, rand} = GitGame.Chaos.packs(game, rand)

    packs =
      for id <- game.seats do
        if id in bots do
          json =
            View.for_player(%{game: game, version: 1, days: [], opened: [], sent: []}, "g", id)
            |> Bot.write_pack()

          {:ok, pack} = Pack.decode(json, 4)
          {id, pack}
        else
          List.keyfind(chaos, id, 0) || {id, []}
        end
      end

    {game, _} = Resolver.close_day(game, packs)
    play(game, bots, rand)
  end

  test "over 200 games the bot's packs always pass the same door as anyone's, and every game is released" do
    for seed <- 1..200, do: assert(play(seed, ["p1", "p2"]).released)
  end

  test "the bot beats a player who sends random packs" do
    wins = Enum.count(1..200, fn seed -> "p1" in Release.winners(play(seed, ["p1"])) end)
    assert wins >= 150, "the bot won only #{wins} of 200 against chaos"
  end
end
