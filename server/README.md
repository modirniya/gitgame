# server

The remote: the Elixir and Phoenix app that holds the rules, the resolver and every game's event log. It is built milestone by milestone from [docs/design/phase-1-plan.md](../docs/design/phase-1-plan.md). Every game is an append-only log of inputs in Postgres, folded through the pure resolver on every read ([ADR-0004](../docs/adr/0004-the-event-log-stores-inputs.md)); Oban closes each day at its deadline.

## Run it

You need Elixir 1.20 on OTP 29, and a Postgres you can log in to. The dev and test configs read the standard `PGUSER`, `PGPASSWORD` and `PGHOST` variables. They default to your OS user on `localhost`, which is what a Homebrew Postgres lets in without a password.

```bash
mix setup          # deps, create and migrate the dev database
mix phx.server     # http://localhost:4000/api/health
mix test           # creates and migrates the test database first
```

## The API

JSON, under `/api`. Errors are `{"error": message}` in Git's words where Git has them. Making players (per address) and games and rooms (per player) is capped per hour (`config :gitgame, :rate_limits`); past the cap, `429` with `retry-after`. A device is signed in by an `HttpOnly` session cookie ([ADR-0005](../docs/adr/0005-sign-in-written-fresh.md)); writes from another site's pages are refused. You see and write a game only as a seat you hold; anyone else gets the table's view.

| | |
|---|---|
| `POST /players` | An anonymous player with a generated handle, and this device signed in as them (`201`); a device already signed in gets its player back (`200`) |
| `GET /session` | Who this device is signed in as, and whether this server can link GitHub (`link_github`), or `401` |
| `GET /auth/github` | A page navigation, not an API call: sends the browser to GitHub to link an account (no scopes asked), and GitHub back to `/auth/github/callback`, which signs the device in as the account's player and returns to the client |
| `DELETE /session` | Signs this device out (`204`) |
| `GET /games` | Signed in: your games (M9c), each with its day, your seats, `waiting_on_you` (your seats whose pack isn't in today) and scores; those waiting on you first, finished ones last |
| `POST /games` | Signed in: `{"hotseat": [...], "bots": [...], "day_length": "live" \| "lunch" \| "correspondence", "seed": n}`. You take the first seat, under your handle, and hold the seats of the `hotseat` people at your device → the game from your seat |
| `GET /games/:id` | The game from your seat: your own cards, branch and traps, every day log as you may see it, and `yours`, the seats you hold (`?seat=` picks one in a hotseat game). A device holding no seat gets the table's view |
| `GET /games/:id/days/:day` | A replay: the view as it stood when `day` closed (`0`: as created), folded from the log up to there; seats as above |
| `POST /games/:id/packs` | Signed in: `{"version", "ops", "discard"}`, and `"seat"` if you hold several, sends or replaces today's pack for a seat you hold; `409` if the day has moved on (`fetch first`) |
| `POST /rooms` | Signed in: opens a room (M9) with you as its host and first member → the room: its `code`, host, members, bots, day length |
| `GET /rooms/:code` | The room, and whether you're in it (`you.member`) or host it (`you.host`); `game_id` once its game has started |
| `POST /rooms/:code/join` | Signed in: joins the room; `409` once it is full (five seats, members and bots) or started |
| `PATCH /rooms/:code` | The host: `{"bots", "day_length"}` |
| `POST /rooms/:code/start` | The host: starts the game, members' seats in the order they joined, then the bots → the room with its `game_id` |
| `GET /rooms/:code/live` | Server-Sent Events: `refetch` on connecting and whenever the room changes; ends when its game starts |
| `GET /email`, `PUT /email`, `DELETE /email` | Signed in: the address given for reminders (`{"address", "digest"}`), set (a confirmation link is emailed; capped per hour), or removed |
| `GET /email/confirm`, `GET` or `POST /email/unsubscribe` | The links in emails: page navigations that come back to the client (`?email=confirmed`), and a mail client's one-click unsubscribe (RFC 8058) |
| `GET /push` | The VAPID public key a browser subscribes to reminders with (ADR-0006), or `404` if push is off |
| `POST /push/subscriptions` | Signed in: keeps a browser's push subscription (`{"endpoint", "keys"}`); only browsers' own push services are accepted |
| `DELETE /push/subscriptions` | Signed in: forgets it (`{"endpoint"}`) |
| `GET /games/:id/live` | Server-Sent Events: `refetch` on connecting and whenever the log grows, nothing else; ends after the release |
| `GET /health` | Whether the server and its database are up |

## Linking GitHub

Anonymous play needs nothing. To let players link GitHub, create a GitHub OAuth app whose callback URL is the address people reach the game at plus `/api/auth/github/callback` (in development, `http://localhost:5173/api/auth/github/callback`, since the Vite server proxies `/api` here), and start the server with its credentials:

```bash
GITGAME_GITHUB_CLIENT_ID=... GITGAME_GITHUB_CLIENT_SECRET=... mix phx.server
```

The tests never reach GitHub: `test/support/github_stub.ex` stands in for it.

## The beta report

What the beta records for the playtest it stands in for ([ADR-0002](../docs/adr/0002-beta-before-human-playtest.md), M12): games started and finished, when packs were sent against how they went, failed pushes and what followed, absences, replays, and players who came back. It reads every game's log and the few marks the log can't hold (visits, replays opened); nothing is shown to players.

```bash
mix gitgame.beta_report          # readable
mix gitgame.beta_report --json   # for a script
```

## Production

The root `Dockerfile` builds the whole game into one image: the web client, the server's release, and the rules. It serves the client from the same origin as `/api`, which the session cookie needs, and migrates its database before it starts. It needs:

| | |
|---|---|
| `DATABASE_URL` | `ecto://user:password@host/database` |
| `SECRET_KEY_BASE` | signs cookies: `mix phx.gen.secret` |
| `PHX_HOST` | the host people reach the game at, e.g. `gitgame.online` |
| `PORT` | where it listens (default 4000) |
| `GITGAME_GITHUB_CLIENT_ID`, `GITGAME_GITHUB_CLIENT_SECRET` | optional: linking GitHub |
| `GITGAME_SMTP_RELAY`, `GITGAME_SMTP_PORT`, `GITGAME_SMTP_USERNAME`, `GITGAME_SMTP_PASSWORD` | optional: reminders by email and the daily digest, through any SMTP provider (TLS always); in development emails are written to the log |
| `GITGAME_VAPID_PUBLIC_KEY`, `GITGAME_VAPID_PRIVATE_KEY`, `GITGAME_VAPID_SUBJECT` | optional: reminders by Web Push; `mix gitgame.vapid_keys` makes a pair, and changing it later unsubscribes every browser |

Behind a proxy, the proxy must terminate TLS and pass on `x-forwarded-proto`. Without Docker, the same release is `MIX_ENV=prod mix release`, once `web/dist/` has been copied into `priv/static/` and `rules/` into `priv/rules/` (see the `Dockerfile`), then `bin/migrate` and `bin/server`. Where it runs is M11's decision; CI builds the image and plays a game against it on every pull request.

## Before you push

CI runs exactly these, and fails on any of them:

```bash
mix format --check-formatted
mix compile --warnings-as-errors
mix test
```
