# ADR-0008: The beta's database lives on an existing Postgres, for now

*Status: Accepted · Date: 2026-09-30*

## Context

[ADR-0007](0007-where-the-beta-runs.md) put the beta on Fly.io with Fly's **managed** Postgres. At setup, the maintainer's cheapest managed plan (Basic) was $38.00 a month before storage (Fly's documentation, 2026-09-30), for a beta whose load is a handful of games. The maintainer's Fly organization already runs an unmanaged Postgres app, `rps-db` (Fly's `postgres-flex`, Postgres 18, in `lax`), for another project.

## Decision

The beta's database is a database of its own, `gitgame`, on `rps-db`, with a user of its own, `gitgame`, that is **not** a superuser, so the game's credentials reach nothing of the other project's. The app runs in `lax`, beside it. The maintainer chose this on 2026-09-30. It supersedes ADR-0007's "Fly's managed Postgres"; the rest of ADR-0007 stands.

## Alternatives considered

- **Managed Postgres Basic, as ADR-0007 said.** Backups, failover and monitoring handled by Fly, at $38 a month plus storage. The better home once the beta has players worth protecting; set aside for now on cost.
- **A new unmanaged Postgres app of the game's own.** Isolated, and cheap, but one more database to run, for no gain the separate database and user don't already give.

## Consequences

- **Backups are the volume snapshots of `rps-db`**, not Fly's managed backups: daily, kept five days (checked 2026-09-30). Before M13 lets strangers in, restore one once into a scratch app, so a restore has been done before it is needed.
- **The volume is 1 GB,** shared with the other project. A game's log is a few kilobytes, so that's many thousands of games, but watch it (`fly volumes list -a rps-db`).
- **The two projects share a machine.** A heavy moment in one slows the other, and upgrading or restarting `rps-db` takes the game's database down with it.
- **Moving later is a dump and a restore**: `pg_dump` of `gitgame`, restored into a managed cluster, and `DATABASE_URL` changed. The app doesn't change.

## Supersedes / superseded by

Supersedes [ADR-0007](0007-where-the-beta-runs.md)'s choice of Fly's managed Postgres.
