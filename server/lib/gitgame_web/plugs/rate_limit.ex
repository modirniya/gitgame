defmodule GitGameWeb.Plugs.RateLimit do
  @moduledoc """
  A cap on how often one address may make players, and one player may make games and rooms (ADR-0005: anyone can
  make an anonymous player, so something must stop a script making a million). A fixed window an hour long, counted
  in ETS on each server: a limit, not game state, so charter decision 8 has nothing to say about it, and a restart
  that forgets the counts forgives nobody for long.

      plug GitGameWeb.Plugs.RateLimit, bucket: :players, by: :ip
      plug GitGameWeb.Plugs.RateLimit, bucket: :games, by: :player

  The limits are `config :gitgame, :rate_limits` (per hour, by bucket). `:ip` is `conn.remote_ip`, so behind a proxy
  the proxy must say who asked (M11).
  """
  import Plug.Conn

  @table __MODULE__
  @window 3600

  def init(opts), do: Map.new(opts)

  def call(conn, %{bucket: bucket, by: by} = opts) do
    limit = opts[:limit] || Application.fetch_env!(:gitgame, :rate_limits)[bucket]

    case who(conn, by) do
      nil -> conn
      who -> count(conn, {bucket, who}, limit)
    end
  end

  defp who(conn, :ip), do: conn.remote_ip
  defp who(%{assigns: %{player: %{id: id}}}, :player), do: id
  defp who(_conn, :player), do: nil

  defp count(conn, key, limit) do
    window = div(System.system_time(:second), @window)
    n = :ets.update_counter(@table, {key, window}, {2, 1}, {{key, window}, 0})

    if n <= limit do
      conn
    else
      conn
      |> put_resp_header(
        "retry-after",
        Integer.to_string((window + 1) * @window - System.system_time(:second))
      )
      |> put_resp_content_type("application/json")
      |> send_resp(
        429,
        JSON.encode!(%{error: "fatal: too many requests from here; try again within the hour"})
      )
      |> halt()
    end
  end

  @doc false
  def window, do: @window

  defmodule Table do
    @moduledoc "Owns the counters' ETS table, and every ten minutes forgets the windows that have closed."
    use GenServer

    @table GitGameWeb.Plugs.RateLimit

    def start_link(_), do: GenServer.start_link(__MODULE__, nil, name: __MODULE__)

    @impl true
    def init(nil) do
      :ets.new(@table, [:named_table, :public, :set, write_concurrency: true])
      schedule()
      {:ok, nil}
    end

    @impl true
    def handle_info(:sweep, state) do
      current = div(System.system_time(:second), GitGameWeb.Plugs.RateLimit.window())
      :ets.select_delete(@table, [{{{:_, :"$1"}, :_}, [{:<, :"$1", current}], [true]}])
      schedule()
      {:noreply, state}
    end

    defp schedule, do: Process.send_after(self(), :sweep, :timer.minutes(10))
  end
end
