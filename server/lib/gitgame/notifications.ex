defmodule GitGame.Notifications do
  @moduledoc """
  "Your pack is due", and "v1.0 has shipped" (ADR-0006): the retention loop (charter decision 16), sent only in games
  whose days are 24 hours long. In a shorter game the day would close before a reminder was read.

  When such a day opens, a reminder job runs at once and another when a quarter of the day is left. Each finds the
  people whose pack isn't in, and who haven't left the company, and sends them a reminder on every channel that
  reaches them. The `notifications` table's unique index keeps it to **one per game a day on each channel**,
  whatever happens in the day, as the ADR caps it: the later job only reaches someone the first couldn't, a player who
  subscribed in the meantime. When a game is released, everyone in it hears so, once.

  Channels are `config :gitgame, :notification_channels` (`GitGame.Notifications.Channel`).
  """
  import Ecto.Query
  alias GitGame.{Games, Repo}
  alias GitGame.Games.Seat
  alias GitGame.Notifications.{Remind, Sent}

  # the shortest day a reminder is worth sending in
  @worth 86_400

  @doc "Whether days `seconds` long are worth a reminder."
  def worth?(seconds), do: seconds >= @worth

  @doc "A day has opened, closing at `deadline` after `seconds`: schedules its reminders, if the day is long enough."
  def day_opened(game_id, day, deadline, seconds) when seconds >= @worth do
    Oban.insert!(Remind.new(%{game_id: game_id, day: day, kind: "pack_due"}))

    Oban.insert!(
      Remind.new(%{game_id: game_id, day: day, kind: "pack_due"},
        scheduled_at: DateTime.add(deadline, -div(seconds, 4), :second)
      )
    )

    :ok
  end

  def day_opened(_game_id, _day, _deadline, _seconds), do: :ok

  @doc "A game has been released on `day`: schedules telling everyone in it, if its days are long enough."
  def released(game_id, day, seconds) when seconds >= @worth do
    Oban.insert!(Remind.new(%{game_id: game_id, day: day, kind: "released"}))
    :ok
  end

  def released(_game_id, _day, _seconds), do: :ok

  @doc false
  # What the job does: works out who to tell, from the game as its log makes it now. `channels` defaults to the
  # configured ones; a test names its own.
  def send_now(
        game_id,
        day,
        kind,
        channels \\ Application.get_env(:gitgame, :notification_channels, [])
      ) do
    with {:ok, state} <- Games.load(game_id) do
      game = state.game

      held =
        Repo.all(
          from s in Seat,
            where: s.game_id == ^game_id and not is_nil(s.player_id),
            preload: :player
        )

      recipients =
        case kind do
          # a reminder for a day that has since closed, or a game since released, reminds no one
          "pack_due" when game.day == day and game.released == nil ->
            for s <- held, s.seat not in state.sent, not game.players[s.seat].left, do: s.player

          "released" ->
            Enum.map(held, & &1.player)

          _ ->
            []
        end

      for player <- Enum.uniq_by(recipients, & &1.id),
          do: notify(player, message(kind, game_id, day, game), channels)

      :ok
    else
      {:error, :not_found} -> {:cancel, "no game #{game_id}"}
    end
  end

  defp message("pack_due", game_id, day, game) do
    %{
      kind: "pack_due",
      game_id: game_id,
      day: day,
      title: "your pack is due",
      body: "day #{day} of #{game.final_day}: send your pack before the day closes",
      path: "/#/g/#{game_id}"
    }
  end

  defp message("released", game_id, day, _game) do
    %{
      kind: "released",
      game_id: game_id,
      day: day,
      title: "v1.0 has shipped",
      body: "the game is over: see how it went, and replay it",
      path: "/#/g/#{game_id}"
    }
  end

  defp notify(player, message, channels) do
    for channel <- channels, channel.reaches?(player) do
      sent = %Sent{
        player_id: player.id,
        game_id: message.game_id,
        day: message.day,
        kind: message.kind,
        channel: channel.name()
      }

      # recorded before it is sent: a job that runs twice, or two jobs at once, send it once
      case Repo.insert(sent, on_conflict: :nothing) do
        {:ok, %Sent{id: id}} when id != nil -> channel.deliver(player, message)
        {:ok, _already} -> :ok
      end
    end
  end
end
