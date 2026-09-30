# ADR-0007: Where the beta runs

*Status: Accepted; its choice of managed Postgres superseded by [ADR-0008](0008-the-beta-shares-a-postgres.md) · Date: 2026-09-30*

## Context

M11 puts the game on gitgame.online, deployed from tags, never branches ([workflow.md](../workflow.md)). What is already decided narrows the choice.

- **What there is to host (M11a):** one Docker image, which serves the client and the API from one origin, migrates its database before serving, and has been built and played in CI. It needs a Postgres, a secret, and a hostname.
- **What the game asks of a host:**
  - **Long-lived connections.** Every open game holds a Server-Sent Events stream (charter decision 9), so a host that cuts idle requests at 30 or 60 seconds breaks the live view. The stream already sends a comment every 25 seconds.
  - **A managed Postgres with backups.** The database *is* the game (charter decision 8), and a lost database is every game lost.
  - **TLS on a custom domain,** and a proxy that passes on `x-forwarded-proto` and the caller's address. The rate limits count by address (M12c).
  - **Deploys from CI:** push an image for a tag, migrate, then switch.
  - **A beta's cost and a beta's scale.** One small instance and a small database are the target, since the success measure is games completed, not load.
- **What is not needed yet:** several regions, or clustering. Nothing holds game state in memory, so a second instance later needs only PubSub between them (the refetch signal).
- **A constraint:** email (ADR-0006) needs an SMTP provider, which the host may or may not offer.

## Decision

Run the beta on **Fly.io**: one machine running the image, **Fly's managed Postgres**, a certificate for gitgame.online, and a deploy workflow on `v*` tags that pushes the image and runs `bin/migrate` as a release command.

**Why:**
- It runs a Docker image as it is.
- It keeps long-lived HTTP connections open through its proxy.
- It terminates TLS and forwards `fly-client-ip`, `x-forwarded-for` and `x-forwarded-proto`.
- It is used widely for Phoenix, and its `flyctl` deploys from GitHub Actions.

**To confirm at acceptance, because they change:** current prices for the smallest machine and managed Postgres; the Postgres backup terms; and the region nearest the first players.

## Alternatives considered

- **Render.** A Docker web service, managed Postgres, TLS and deploy hooks: a close second, and the choice if Fly's managed Postgres terms don't suit. Its request timeout and how it treats long-lived streams must be checked before choosing it.
- **Gigalixir.** Built for Elixir, but around buildpack builds and its own release flow, not our image. We'd maintain two ways of building the same thing.
- **A VPS (Hetzner, DigitalOcean) with Docker and a TLS proxy (Caddy).** The cheapest per month and entirely ours, but backups, upgrades, TLS renewal and uptime become our work, for a beta whose point is to learn whether the game is fun. It's a good later home, once the beta says what the load is.
- **A platform that sleeps idle services.** It would drop every live SSE stream, and the first request after a sleep would take seconds. Rejected: a game opened a week later must open at once (charter decision 9).

## Consequences

- **M11b** is creating the Fly app and its Postgres, setting `DATABASE_URL`, `SECRET_KEY_BASE` and `PHX_HOST` (and later GitHub's and the VAPID keys) as secrets, and pointing gitgame.online at it. **The maintainer does this:** it needs the account, and a payment method.
- **M11c** is a workflow on `v*` tags that deploys the image; it needs a deploy token from the maintainer as a repository secret.
- **The rate limits must count by the client's address:** the server reads it from Fly's forwarded header, set only by Fly's proxy.
- **Leaving is cheap.** The image is host-agnostic and CI proves it on every pull request, so a move to Render or a VPS later is a new deploy workflow and a database dump, not a rewrite.

## Supersedes / superseded by

None. It settles the charter's open "hosting" item (Phase 1 plan, open items).
