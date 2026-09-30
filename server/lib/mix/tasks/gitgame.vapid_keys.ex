defmodule Mix.Tasks.Gitgame.VapidKeys do
  @shortdoc "Makes a VAPID key pair for Web Push (ADR-0006)"
  @moduledoc """
  Prints a new VAPID key pair, as the environment variables the server reads. Keep the private key a secret of the
  deployment; changing the pair later unsubscribes every browser, since they subscribed to the old public key.

      mix gitgame.vapid_keys
  """
  use Mix.Task

  @impl true
  def run(_args) do
    {public, private} = GitGame.Push.generate_keys()

    Mix.shell().info("""
    GITGAME_VAPID_PUBLIC_KEY=#{public}
    GITGAME_VAPID_PRIVATE_KEY=#{private}
    GITGAME_VAPID_SUBJECT=mailto:you@example.com
    """)
  end
end
