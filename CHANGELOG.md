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
