defmodule GitGameWeb.StatsController do
  @moduledoc "`GET /api/stats`: the maintainer's pulse (M13e), behind `STATS_TOKEN` (GitGameWeb.Plugs.StatsToken)."
  use GitGameWeb, :controller

  def show(conn, _params), do: json(conn, GitGame.Stats.build())
end
