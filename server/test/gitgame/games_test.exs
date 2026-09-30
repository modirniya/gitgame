defmodule GitGame.GamesTest do
  use GitGame.DataCase, async: true
  alias GitGame.{Game, Games, Resolver, Rules}
  alias GitGame.Games.{Event, Pack, Record}

  defp new_game(opts \\ []), do: Games.create(["ana", "raj"], Keyword.merge([seed: 42], opts))

  # A pack that ships the player's biggest clean card, as JSON: what a client would send.
  defp ship(game, player) do
    card =
      game.players[player].hand
      |> Enum.filter(&(&1.kind == :commit and not &1.bug))
      |> Enum.max_by(& &1.lines)

    %{
      "ops" => [
        %{"op" => "add", "cards" => [card.id]},
        %{"op" => "commit", "message" => "feat: ship it"},
        %{"op" => "pull"},
        %{"op" => "push"}
      ]
    }
  end

  test "a new game is stored with its rules, and loads with day 1 open" do
    {:ok, %{id: id, version: 1}} = new_game()
    {:ok, state} = Games.load(id)

    assert state.game.day == 1
    assert state.version == 1
    assert state.days == []
    assert [%{type: :day_opened, day: 1} | _] = state.opened
    assert Repo.get!(Record, id).rules == Rules.read_maps!()
  end

  test "a game that can't exist isn't created" do
    assert {:error, :invalid, "a game needs 2 to 5 different players" <> _} =
             Games.create(["ana"])

    assert {:error, :invalid, "no day length" <> _} = new_game(day_length: "fortnight")
  end

  test "the log folds to exactly what the pure resolver makes of the same packs" do
    {:ok, %{id: id}} = new_game()
    {:ok, %{game: game}} = Games.load(id)
    ana = ship(game, "ana")
    raj = ship(game, "raj")

    {:ok, _} = Games.send_pack(id, "ana", 1, ana)
    {:ok, _} = Games.send_pack(id, "raj", 1, raj)
    {:ok, %{day: 1, version: version}} = Games.close_day(id)

    # nothing is kept in memory: loading reads the log and folds it again, as after a restart
    {:ok, loaded} = Games.load(id)
    assert loaded.version == version
    assert loaded.game.day == 2

    {:ok, a} = Pack.decode(ana, 4)
    {:ok, r} = Pack.decode(raj, 4)
    {expected, log} = Resolver.close_day(game, [{"ana", a}, {"raj", r}])
    assert loaded.game == expected
    assert [%{day: 1, log: closed}] = loaded.days
    assert closed ++ loaded.opened == log
  end

  test "a pack written before a day closed is rejected: the remote has moved on" do
    {:ok, %{id: id}} = new_game()
    {:ok, _} = Games.close_day(id)

    assert {:error, :stale, "! [rejected]        main -> main (fetch first)"} =
             Games.send_pack(id, "ana", 1, %{"ops" => []})
  end

  test "other players' packs don't make yours stale; a second pack replaces the first" do
    {:ok, %{id: id}} = new_game()
    {:ok, %{game: game}} = Games.load(id)
    {:ok, _} = Games.send_pack(id, "ana", 1, %{"ops" => [%{"op" => "commit"}]})
    {:ok, _} = Games.send_pack(id, "raj", 1, %{"ops" => []})
    {:ok, _} = Games.send_pack(id, "ana", 1, ship(game, "ana"))
    {:ok, _} = Games.close_day(id)

    {:ok, %{days: [%{log: log}]}} = Games.load(id)
    assert Enum.any?(log, &(&1.type == :push_accepted and &1.player == "ana"))
    refute Enum.any?(log, &(&1.type == :op_failed and &1.player == "ana"))
  end

  test "a pack that isn't a pack is refused, and nothing is stored" do
    {:ok, %{id: id}} = new_game()
    before = Repo.aggregate(Event, :count)

    assert {:error, :invalid, "git: 'yolo' is not a git command. See 'git --help'."} =
             Games.send_pack(id, "ana", 1, %{"ops" => [%{"op" => "yolo"}]})

    assert {:error, :invalid, "a pack lists at most 4 ops, not 5"} =
             Games.send_pack(id, "ana", 1, %{"ops" => List.duplicate(%{"op" => "push"}, 5)})

    assert {:error, :not_a_player, _} = Games.send_pack(id, "kim", 1, %{"ops" => []})

    assert {:error, :not_found, _} =
             Games.send_pack(Ecto.UUID.generate(), "ana", 1, %{"ops" => []})

    assert Repo.aggregate(Event, :count) == before
  end

  test "a day closes once, however often it is asked" do
    {:ok, %{id: id}} = new_game()
    {:ok, %{day: 1, already_closed: false}} = Games.close_day(id, 1)
    {:ok, %{day: 1, already_closed: true}} = Games.close_day(id, 1)
    {:ok, %{game: %Game{day: 2}}} = Games.load(id)
  end

  test "the log is append-only: the database refuses to change or delete it" do
    {:ok, %{id: id}} = new_game()
    event = Repo.one!(from e in Event, where: e.game_id == ^id)

    assert_raise Postgrex.Error, ~r/game_events is append-only/, fn ->
      Repo.update!(Ecto.Changeset.change(event, type: "forged"))
    end
  end

  test "once released, the game takes no more packs and closes no more days" do
    {:ok, %{id: id}} = new_game()
    for _ <- 1..12, do: {:ok, _} = Games.close_day(id)
    {:ok, %{game: game, version: version}} = Games.load(id)

    assert game.released
    assert {:error, :over, _} = Games.send_pack(id, "ana", version, %{"ops" => []})
    assert {:error, :over, _} = Games.close_day(id)
  end
end
