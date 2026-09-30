# Changelog

All notable changes to this project are recorded here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [Semantic Versioning](https://semver.org/).

Every user-visible change lands under *Unreleased* in the same pull request that makes it. A release moves the section under a version heading with the date.

## [Unreleased]

### Added
- Repository scaffold: license (AGPL-3.0-or-later), governance files, issue and PR templates.
- Project charter as ADR-0000, with the decisions locked on 2026-09-29 and the alternatives set aside.
- Design docs: tabletop base rules and the online round-resolution model (days, packs, remote).
- Conventions, workflow, lifecycle, and branding guides.
- `scripts/brand-audit.sh` to list every use of the working name.
- Tabletop deck as data (`rules/deck.json`) and a print-and-play PDF generator (`tabletop/build.py`) for the Phase 0 playtest.
- `prototypes/play-vs-bot`: a playable two-player prototype against a bot with a guided first game, hints, undo and a smoke test; its rule findings are in its README.
- ADR-0001: prototypes are disposable, specs carry over. `docs/design/event-screens.md` specifies the one-event-per-screen mobile flow; `prototypes/mobile/PLAN.md` is the build plan for it.
- `prototypes/mobile`: the one-event-per-screen phone prototype against the bot, with a pure event-emitting engine, every screen in the spec, animations, the guided first game, a playtest recorder and a smoke test. Its findings answer the spec's open questions provisionally and propose three rule changes: no merge token for a fast-forward pull, a hand limit, and making force-push reachable in a two-player game.
- CI: a GitHub Actions workflow runs the mobile prototype's smoke test on every pull request and on pushes to `main`.
- ADR-0002: the human playtest moves to a beta of the real product; the rules stay draft (v0.x) until people have played it.
- `prototypes/packs`: a simulation of the online day/pack model that answers playtest questions 1 and 2 provisionally. Sending first, not last, dominates under arrival order (61:39); batching at the deadline is fair but doubles conflicts. Paying for a rejected push stays. Answers are recorded in `round-resolution.md` §7.
- `docs/design/phase-1-plan.md`: the build plan for Phase 1 (server skeleton, rules, resolver, event log, days, views and bots, hotseat web client) and the beta, with a "done when" for each milestone.

- `server/`: the Phoenix API app (M1): Postgres through Ecto, `GitGame.Brand` as the one definition of the name, and `GET /api/health`, which also checks the database. CI gains a server job (format, compile with warnings as errors, test against Postgres 17).

- `GitGame.Rules` (M2a): the server reads and validates `rules/deck.json` and `rules/online.json`, failing loudly on any missing, unknown or mistyped key. `deck.json` gains stable card ids, machine-readable incident effects and a `scoring` section; `online.json` gains the cards switched on for online play (the tested core, plus two quiet days).

- `GitGame.Game` and `GitGame.Seeded` (M2b): the state of one game and its deal, with every random draw derived from the game's seed and its purpose, so a game replays from its seed alone.

- `GitGame.Ops` and the local ops (M2c): the one interface the resolver runs an op through (its cost at the moment it runs, then its effect as events, or a failure in Git's words), with `add`, `commit` and arming a trap.

- The remote ops (M2d): `push` (free with nothing to push, rejected non-fast-forward from behind, Flaky CI's die on the day's first push) and `pull` / `pull --rebase` (free when up to date; conflicts settled by the declared strategy; a merge token only when unpushed commits were merged).

- The command cards (M2e): `git blame` (a live bug counts against its author), `git revert` (from the tip, +1) and `git push --force` (a sin; an armed `reflog` restores all of its owner's erased commits on top; an erased revert revives its bug). Under Stack Overflow Is Down every command fails, is paid for, and keeps its card.

- The release (M2f): `git tag v1.0` once `main` is the release size; CI flips every commit and counts each unblamed live bug once; production down at four bugs, when the least blame wins; scores broken down by `rules/deck.json`'s scoring, with a face-down bug counting as clean while the game runs. `online.json` gains the cost of `tag` and drops an unused `command_card` cost.

- The resolver (M3a): `GitGame.Resolver` opens a day (incident, draws) and closes it, resolving every pack in the seeded order (or arrival order, as a setting), each to its budget; then the hand limit, the final day's CI, and the next day. Cards that leave play now go to a discard pile instead of vanishing.

### Changed
- Rules v0.2. ADR-0003: a day's packs resolve together at the deadline, in a seeded random order, instead of on arrival. A plain pull takes a merge token only when it merges unpushed commits. Hand limit of 10. The deck has 5 `push --force` and 4 `reflog` cards (was 3 and 3), 33 command cards in all. The online rules are data in `rules/online.json`; `round-resolution.md` is spec v0.2 with its five ambiguities settled; the print-and-play PDF is rebuilt.
