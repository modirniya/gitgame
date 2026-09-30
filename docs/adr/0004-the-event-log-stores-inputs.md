# ADR-0004: The event log stores what players did, not what the rules made of it

*Status: Accepted · Date: 2026-09-29*

## Context

Charter decision 8 says every game is an append-only event log in Postgres, and its state is derived. The resolver ([`GitGame.Resolver`](../../server/lib/gitgame/resolver.ex)) is pure: a game and a day's packs in, the next game and the day log out. So there are two kinds of event a game could keep: the **inputs** (a game was created with this seed and these players, this pack was sent, this day closed) and the **outputs** (the day log: this push was accepted, this conflict was resolved `ours`).

Either could be the log that state is derived from. The rules can also change between game versions ([ADR-0002](0002-beta-before-human-playtest.md) expects that), and a game in progress must not change with them.

## Decision

The log stores the **inputs**, append-only, with one sequence per game: `game_created`, `pack_sent` (a newer one replaces an older one for the same player and day), and `day_closed`. A game's state is its inputs folded through the resolver. Its day logs are derived the same way and are never the source of truth.

Each game keeps a snapshot of the rules it was created with, read from `rules/*.json` at creation, so a rules change never alters a game in progress or its replay.

A game's **version** is the sequence number of its latest `game_created` or `day_closed` event. Every pack carries the version it was written against. A pack for a version that is no longer current is rejected, as Git rejects a push against a remote that has moved on: `! [rejected] (fetch first)`. Other players' packs don't change the version, because every pack is written against the state the day opened with (ADR-0003).

## Alternatives considered

- **Store the outputs (the day log) and fold them into state.** Rejected. It needs a second implementation of every rule, one that applies a result instead of computing it, and the two would drift apart. The inputs and a pure resolver already determine everything.
- **Store both, with the day log as a cache.** Deferred, not rejected. Folding a game is cheap (at most a few hundred ops); a cache is added when a measurement asks for one, and can always be thrown away.
- **Store only a current-state snapshot.** Rejected by charter decision 8.

## Consequences

- Replaying a game is folding its inputs, which the resolver's property tests already prove deterministic.
- A bug fixed in the resolver changes the day logs of games already played. That is honest (the log shows what the rules make of the inputs), but it means a resolver fix must say, in its PR, whether it changes finished games.
- Every read folds the game from its inputs. That is fine at this size and is the first thing to cache if it ever isn't.

## Supersedes / superseded by

None. Implements charter decision 8.
