defmodule GitGame.GitHub.HTTP do
  @moduledoc """
  How Assent reaches GitHub: Erlang's own `:httpc`, verifying GitHub's certificate against the operating system's CA
  store (`:public_key.cacerts_get/0`) with the standard HTTPS hostname check. Assent's bundled adapters need extra
  packages for that (`:certifi` and `:ssl_verify_fun` for `:httpc`), or, for Req in Assent 0.3.1, report the
  request's headers as the response's, which breaks GitHub's form-encoded token response. This is the whole adapter.
  """
  @behaviour Assent.HTTPAdapter
  alias Assent.HTTPAdapter.HTTPResponse

  @impl true
  def request(method, url, body, headers, _opts \\ nil) do
    headers = [{"user-agent", "gitgame"} | headers]
    {type, headers} = List.keytake(headers, "content-type", 0) |> content_type(headers)
    charlist = fn {k, v} -> {to_charlist(k), to_charlist(v)} end

    request =
      if body,
        do: {to_charlist(url), Enum.map(headers, charlist), to_charlist(type), body},
        else: {to_charlist(url), Enum.map(headers, charlist)}

    ssl = [
      verify: :verify_peer,
      cacerts: :public_key.cacerts_get(),
      customize_hostname_check: [match_fun: :public_key.pkix_verify_hostname_match_fun(:https)]
    ]

    case :httpc.request(method, request, [ssl: ssl, timeout: 15_000], body_format: :binary) do
      {:ok, {{_, status, _}, response_headers, response_body}} ->
        {:ok,
         %HTTPResponse{
           http_adapter: __MODULE__,
           request_url: url,
           status: status,
           headers:
             Enum.map(response_headers, fn {k, v} ->
               {String.downcase(to_string(k)), to_string(v)}
             end),
           body: response_body
         }}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp content_type({{_, type}, rest}, _headers), do: {type, rest}
  defp content_type(nil, headers), do: {"application/x-www-form-urlencoded", headers}
end
