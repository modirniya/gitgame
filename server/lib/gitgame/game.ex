defmodule GitGame.Game do
  @moduledoc """
  The state of one game: `main`, every player's hand, staging area, local branch, pointer and tokens, the draw pile,
  the day and its incident. It is never stored: it is what folding a game's events over `new/3` produces, and the
  resolver is the only thing that changes it (charter decision 8, "the database is the game").

  A player's `pointer` is how many commits of `main` they have: 1 is the initial commit, and a player is at the tip
  when their pointer equals `length(main)`, so "behind by" is the difference.
  """
  alias GitGame.{Rules, Seeded}

  defmodule Player do
    @moduledoc "One player's side of the table: private cards and branch, public pointer and tokens."
    defstruct hand: [],
              staged: [],
              local: [],
              pointer: 1,
              merge: 0,
              grudges: 0,
              sins: 0,
              blame: 0,
              fixes: 0,
              armed: [],
              empty_days: 0,
              left: false
  end

  @type t :: %__MODULE__{}

  @enforce_keys [
    :rules,
    :seed,
    :seats,
    :players,
    :main,
    :draw_pile,
    :next_commit,
    :length,
    :final_day
  ]
  defstruct @enforce_keys ++ [discard: [], day: 0, incident: nil, rolled: false, released: nil]

  @doc """
  A new game for `player_ids`, in seat order, played in days of `length` (a name from `rules/online.json`'s
  `day.lengths`, `"live"` unless given), which also sets the final day: the draw pile is the online deck (every commit card, and each command
  card switched on in `rules/online.json`, as many times as the deck prints it), shuffled by the seed; everyone is
  dealt the starting hand, one card at a time around the table; `main` holds only the initial commit.
  """
  def new(%Rules{} = rules, seed, player_ids, length \\ "live") when is_integer(seed) do
    {fewest, most} = rules.release_at |> Map.keys() |> Enum.min_max()

    unless length(player_ids) in fewest..most and player_ids == Enum.uniq(player_ids),
      do:
        raise(
          ArgumentError,
          "a game needs #{fewest} to #{most} different players, got #{inspect(player_ids)}"
        )

    unless Map.has_key?(rules.final_day, length),
      do: raise(ArgumentError, "no day length #{inspect(length)} in the rules")

    {pile, _} = rules |> online_deck() |> Seeded.shuffle(Seeded.stream(seed, :deck))
    {hands, pile} = deal(pile, player_ids, rules.starting_hand)

    %__MODULE__{
      rules: rules,
      seed: seed,
      seats: player_ids,
      players: Map.new(player_ids, &{&1, %Player{hand: Map.fetch!(hands, &1)}}),
      main: [%{id: Seeded.sha(seed, 0), author: nil, cards: [], initial: true, flipped: true}],
      draw_pile: pile,
      next_commit: 1,
      length: length,
      final_day: rules.final_day[length]
    }
  end

  @doc "The unshuffled online deck, each card with an id that stays the same for the whole game."
  def online_deck(%Rules{} = rules) do
    commits = Enum.map(rules.commit_cards, &Map.put(&1, :kind, :commit))

    commands =
      for {id, %{count: count}} <- Enum.sort(rules.commands),
          _ <- 1..count//1,
          do: %{kind: :command, command: id}

    (commits ++ commands)
    |> Enum.with_index(1)
    |> Enum.map(fn {card, i} -> Map.put(card, :id, "k#{i}") end)
  end

  # One card at a time around the table, as at a real table: the deal can't favour a seat.
  defp deal(pile, seats, per_player) do
    Enum.reduce(1..per_player//1, {Map.new(seats, &{&1, []}), pile}, fn _, acc ->
      Enum.reduce(seats, acc, fn id, {hands, [card | rest]} ->
        {Map.update!(hands, id, &(&1 ++ [card])), rest}
      end)
    end)
  end

  @doc "The game with one player's side of the table replaced."
  def put_player(%__MODULE__{} = game, id, %Player{} = p),
    do: %{game | players: Map.put(game.players, id, p)}

  @doc "Cards leaving play for good: spent commands, armed traps, dropped commits, the hand limit."
  def discard(%__MODULE__{} = game, cards),
    do: %{game | discard: game.discard ++ List.wrap(cards)}

  @doc "How many commits on `main` the player hasn't pulled."
  def behind_by(%__MODULE__{main: main, players: players}, id),
    do: length(main) - players[id].pointer

  @doc "The number of commits on `main`, not counting the initial one: what the release size is measured in."
  def commits_on_main(%__MODULE__{main: main}), do: length(main) - 1
end
