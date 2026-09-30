defmodule GitGame.PushStub do
  @moduledoc """
  Browsers' push services, for tests: each push is sent to the test process as `{:pushed, endpoint, headers}`. An
  endpoint ending in `/gone` answers 410, as a push service does for a subscription the browser dropped.
  """
  alias Assent.HTTPAdapter.HTTPResponse

  def request(:post, endpoint, _body, headers, _opts \\ nil) do
    send(self(), {:pushed, endpoint, Map.new(headers)})
    status = if String.ends_with?(endpoint, "/gone"), do: 410, else: 201
    {:ok, %HTTPResponse{status: status, headers: [], body: ""}}
  end
end
