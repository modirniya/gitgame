# ADR-0002: Ship a beta before the human playtest

*Status: Accepted · Date: 2026-09-29*

## Context

The [charter](0000-project-charter.md) makes Phase 0 a human playtest of the rules: "Paper deck or single-browser hotseat. Four developers, one lunch, three days of play", before any product code. Its exit is "the spec is revised to v1.0 and at least two people ask to play again unprompted", and §3 records "prototype after the idea is locked" as the alternative we walked away from in favour of "playtest the rules first".

Phase 0 so far has produced a print-and-play deck and two prototypes, both disposable ([ADR-0001](0001-prototypes-are-disposable.md)). [play-vs-bot](../../prototypes/play-vs-bot/README.md) is a desktop game against a bot; [mobile](../../prototypes/mobile/README.md) is the one-event-per-screen phone version of it. Both play the *tabletop* game, with alternating turns. Nobody but the builder has played either. The *online* model the product runs, days and packs resolved in arrival order ([round-resolution.md](../design/round-resolution.md)), has not been played or simulated at all, and the charter's three playtest questions all belong to it.

The maintainer has decided to get human feedback from people playing a beta of the real product, rather than from a table playtest first.

## Decision

We build Phase 1 and a beta before the human playtest, and **the beta is the playtest**. Phase 0's exit criterion is unchanged but is measured on the beta: the rules become v1.0, and at least two people ask to play again unprompted. Until then the rules stay *Draft* (v0.x), and every open rules question is decided on simulation data from the prototypes, with the reasoning written into the spec.

## Alternatives considered

- **Playtest at a table first, as the charter says.** Set aside by the maintainer. The print-and-play deck still exists, and a table session remains possible at any time; nothing here prevents it.
- **Keep prototyping until simulations settle the rules, then build.** Simulations can measure balance (who wins, how long games run, what an op is worth). They cannot measure whether the game is fun, which is the charter's first priority, so people are needed either way. Waiting for rules that can't be settled without them only delays the thing that can.

## Consequences

Product code is built on rules that will change after people play them. These guardrails keep that cheap:

- **The batching switch stays one change.** The resolver keeps process-on-arrival versus deadline-batching (charter decision 11, playtest question 1) as a single change in the resolver, and its property tests run under both policies, so flipping it after the beta is a configuration and test change, not a rewrite.
- **Rules stay data.** Every number a playtest might move (op costs, hand size, deck counts, the merge-token rule) lives in `rules/`, as the conventions already require, so a rules change after the beta doesn't need a code change.
- **The beta records what the playtest would have.** It captures when each pack was sent relative to its outcome (question 1), failed pushes and what followed them (question 2), absences (question 3), and completed games and replays (the exit criterion), without the player doing anything.
- **Nothing keeps score across games until v1.0.** Leaderboards, ratings and Teams features wait for rules v1.0, because a rules change would make old results incomparable.
- **Open rule questions get numbers first.** Each one gets a simulation before Phase 1 code depends on it; the pack-model simulation for questions 1 and 2 is the first.

What we accept: the first real players meet a game whose rules may still be wrong, in a product rather than at a table where a rule can be crossed out mid-game. Rework is likely in the rules docs and data; the guardrails above are there to keep it out of the architecture.

## Supersedes / superseded by

Amends [ADR-0000](0000-project-charter.md) §5 (Phase 0: the playtest and its exit move to the beta) and its §3 row "prototype after the idea is locked / playtest the rules first". It does not supersede the charter.
