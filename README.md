# Git Game

> **Two notices, read them first.**
>
> **The name is not final.** "Git Game" and gitgame.online are the working name and domain. There is a small chance the project will need a different name. Every use of the name follows [docs/branding.md](docs/branding.md), so it can be found and changed in one pass.
>
> **This project is built with AI.** A substantial part of the design, documentation, and code is produced with Anthropic's Claude and reviewed by humans who are accountable for it. What that means in practice, and how AI-written work is marked, is in [AI_DISCLOSURE.md](AI_DISCLOSURE.md).

An asynchronous multiplayer card game whose rules *are* Git.

Players race to ship commits to a shared `main`: commit, push, pull, rebase, resolve conflicts, bluff bugs past `git blame`, and survive `push --force`. There are no turns — there are **days**, **packs**, and a **remote** that resolves each day's packs together when the day closes. A day can be 24 hours or 60 seconds, so a week-long correspondence game and a live lunch game are the same game.

The mechanics are accurate to Git. People who know Git enjoy the details; people who don't learn it without meaning to.

## Status

**Phase 2: the beta** ([the plan](docs/design/phase-1-plan.md)). Phase 1 is done: a full game against the bot is played in the browser and replayed from its log, and CI proves it on every change. Since then: anonymous sign-in with GitHub linking, rooms by link, your games, and what the beta records. Next are notifications and hosting, each waiting on an ADR. The rules are v0.2, still a draft: [ADR-0002](docs/adr/0002-beta-before-human-playtest.md) makes the beta the human playtest.

To play it on your machine: the server in [server/](server/README.md), the client in [web/](web/README.md). Progress is tracked in [CHANGELOG.md](CHANGELOG.md).

## Read this repository

| Start here | |
|---|---|
| [Project charter](docs/adr/0000-project-charter.md) | What this is, every locked decision, what we walked away from and why, priorities, roadmap. |
| [Base rules](docs/design/base-rules.md) | The tabletop game the online version derives from. |
| [Round resolution](docs/design/round-resolution.md) | How days, packs, and the remote work. The core of the online rules. |
| [Conventions](docs/conventions.md) | Repository layout, readability rules, vocabulary. |
| [Workflow](docs/workflow.md) | Branches, commits, pull requests, releases. |
| [Lifecycle](docs/lifecycle.md) | How outdated code, docs, and files are retired. |
| [Branding](docs/branding.md) | Canonical spellings of the name and how to find every use of it. |

## Contributing

Contributions are welcome, including rules proposals — see [CONTRIBUTING.md](CONTRIBUTING.md). This is a small project run by [NeuEra LLC](https://neuera.llc); expect honest, direct review and short feedback loops.

## License

Code and documentation: [GNU AGPL-3.0-or-later](LICENSE). The project name, logo, and domain are trademarks-in-use of NeuEra LLC and are not covered by the code license.
