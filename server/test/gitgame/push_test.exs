defmodule GitGame.PushTest do
  use GitGame.DataCase, async: true
  alias GitGame.{Players, Push}
  alias GitGame.Notifications.PushChannel
  alias GitGame.Push.Subscription

  @fcm "https://fcm.googleapis.com/fcm/send/abc123"

  defp player do
    {:ok, p} = Players.create_anonymous()
    p
  end

  test "a push is signed with the deployment's VAPID key: ES256, for the push service's origin" do
    [header, claims, signature] = @fcm |> Push.jwt() |> String.split(".")
    decode = &(&1 |> Base.url_decode64!(padding: false) |> JSON.decode!())

    assert decode.(header) == %{"typ" => "JWT", "alg" => "ES256"}

    assert %{
             "aud" => "https://fcm.googleapis.com",
             "sub" => "mailto:tests@example.com",
             "exp" => exp
           } = decode.(claims)

    assert exp > System.system_time(:second)

    # the raw r and s JOSE wants, verified as the push service would, with the public key alone
    <<r::unsigned-big-size(256), s::unsigned-big-size(256)>> =
      Base.url_decode64!(signature, padding: false)

    der = :public_key.der_encode(:"ECDSA-Sig-Value", {:"ECDSA-Sig-Value", r, s})
    public = Base.url_decode64!(Push.public_key(), padding: false)
    assert :crypto.verify(:ecdsa, :sha256, header <> "." <> claims, der, [public, :prime256v1])
  end

  test "a subscription is kept only for a browser's own push service: the server never posts anywhere else" do
    p = player()

    for ok <- [
          @fcm,
          "https://updates.push.services.mozilla.com/wpush/v2/x",
          "https://web.push.apple.com/Q",
          "https://wns2-par02p.notify.windows.com/w/?token=x"
        ] do
      assert :ok = Push.subscribe(p, %{"endpoint" => ok})
    end

    for bad <- [
          "http://fcm.googleapis.com/x",
          "https://fcm.googleapis.com.evil.example/x",
          "https://localhost/x",
          "https://169.254.169.254/latest",
          "not a url"
        ] do
      assert {:error, :invalid, "fatal: " <> _} = Push.subscribe(p, %{"endpoint" => bad})
    end

    assert Repo.aggregate(Subscription, :count) == 4
  end

  test "waking a player pushes to each of their browsers; a push service saying one is gone forgets it" do
    p = player()
    Push.subscribe(p, %{"endpoint" => @fcm})
    Push.subscribe(p, %{"endpoint" => "https://fcm.googleapis.com/fcm/send/gone"})

    assert PushChannel.reaches?(p)
    :ok = PushChannel.deliver(p, %{})

    assert_received {:pushed, @fcm, %{"ttl" => "86400", "authorization" => "vapid t=" <> auth}}
    assert auth =~ ", k=" <> Push.public_key()
    assert_received {:pushed, "https://fcm.googleapis.com/fcm/send/gone", _}
    assert [%{endpoint: @fcm}] = Repo.all(Subscription)
  end

  test "a browser that subscribes again, for someone else, is theirs now; a player with none isn't reached" do
    [a, b] = [player(), player()]
    Push.subscribe(a, %{"endpoint" => @fcm})
    Push.subscribe(b, %{"endpoint" => @fcm})

    refute PushChannel.reaches?(a)
    assert PushChannel.reaches?(b)
  end
end
