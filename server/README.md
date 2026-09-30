# server

The remote: the Elixir and Phoenix app that will hold the rules, the resolver and every game's event log. It is being built milestone by milestone from [docs/design/phase-1-plan.md](../docs/design/phase-1-plan.md). Today it is the M1 skeleton: an API-only Phoenix app, Postgres through Ecto, and `GET /api/health`.

## Run it

You need Elixir 1.20 on OTP 29, and a Postgres you can log in to. The dev and test configs read the standard `PGUSER`, `PGPASSWORD` and `PGHOST` variables. They default to your OS user on `localhost`, which is what a Homebrew Postgres lets in without a password.

```bash
mix setup          # deps, create and migrate the dev database
mix phx.server     # http://localhost:4000/api/health
mix test           # creates and migrates the test database first
```

## Before you push

CI runs exactly these, and fails on any of them:

```bash
mix format --check-formatted
mix compile --warnings-as-errors
mix test
```
