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

JSON, under `/api`. Errors are `{"error": message}` in Git's words where Git has them. A device is signed in by an `HttpOnly` session cookie ([ADR-0005](../docs/adr/0005-sign-in-written-fresh.md)); writes from another site's pages are refused. You see and write a game only as a seat you hold; anyone else gets the table's view.

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
| `GET /games/:id/live` | Server-Sent Events: `refetch` on connecting and whenever the log grows, nothing else; ends after the release |
| `GET /health` | Whether the server and its database are up |

## Linking GitHub

Anonymous play needs nothing. To let players link GitHub, create a GitHub OAuth app whose callback URL is the address people reach the game at plus `/api/auth/github/callback` (in development, `http://localhost:5173/api/auth/github/callback`, since the Vite server proxies `/api` here), and start the server with its credentials:

```bash
GITGAME_GITHUB_CLIENT_ID=... GITGAME_GITHUB_CLIENT_SECRET=... mix phx.server
```

The tests never reach GitHub: `test/support/github_stub.ex` stands in for it.

## Before you push

CI runs exactly these, and fails on any of them:

```bash
mix format --check-formatted
mix compile --warnings-as-errors
mix test
```
