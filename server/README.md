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

JSON, under `/api`. Errors are `{"error": message}` in Git's words where Git has them. A device is signed in by an `HttpOnly` session cookie ([ADR-0005](../docs/adr/0005-sign-in-written-fresh.md)); writes from another site's pages are refused. Until M8b the game endpoints still take the player's name from the request, which is fine for a hotseat client and nothing else.

| | |
|---|---|
| `POST /players` | An anonymous player with a generated handle, and this device signed in as them (`201`); a device already signed in gets its player back (`200`) |
| `GET /session` | Who this device is signed in as, or `401` |
| `DELETE /session` | Signs this device out (`204`) |
| `POST /games` | `{"seats": [...], "bots": [...], "day_length": "live" \| "lunch" \| "correspondence", "seed": n}` → the public view |
| `GET /games/:id` | The public view; `?player=ana` adds ana's own cards, branch and traps, and shows every day log as she may see it |
| `GET /games/:id/days/:day` | A replay: the view as it stood when `day` closed (`0`: as created), folded from the log up to there; `?player=` as above |
| `POST /games/:id/packs` | `{"player", "version", "ops", "discard"}` sends or replaces today's pack; `409` if the day has moved on (`fetch first`) |
| `GET /games/:id/live` | Server-Sent Events: `refetch` on connecting and whenever the log grows, nothing else; ends after the release |
| `GET /health` | Whether the server and its database are up |

## Before you push

CI runs exactly these, and fails on any of them:

```bash
mix format --check-formatted
mix compile --warnings-as-errors
mix test
```
