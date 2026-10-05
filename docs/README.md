# Documentation index

*Status: Current · Last verified: 2026-09-29*

Every document in `docs/` starts with a status line like the one above. The statuses and what to do with each are defined in [lifecycle.md](lifecycle.md).

## Decisions

| | |
|---|---|
| [adr/](adr/README.md) | Architecture Decision Records. ADR-0000 is the project charter; every later decision that changes it gets its own numbered record. ADRs are never deleted. |

## Design

| | |
|---|---|
| [design/base-rules.md](design/base-rules.md) | The tabletop game: cards, ops, commands, incidents, the release. The online rules derive from it. |
| [design/round-resolution.md](design/round-resolution.md) | Days, packs, and the remote: how the online game resolves without turns. |
| [design/event-screens.md](design/event-screens.md) | The game as events and screens: the spec a phone client is built from. |
| [design/phase-1-plan.md](design/phase-1-plan.md) | The build plan from rules v0.2 to the beta: milestones, what each must show before it counts as done, and open items. |
| [design/how-it-works.md](design/how-it-works.md) | The engineering write-up for launch week, a draft: no turns, a log of inputs, a pure resolver, one seed, Git's words captured. |
| [design/website-content.md](design/website-content.md) | The pages beside the game: three doors, the page list and its waves, and Git's output captured, never typed. |
| [design/website-content-research.md](design/website-content-research.md) | What the website could add to get more impressions while staying on Git: the evidence, a prioritized shortlist, and what not to build. Research as of 2026-10-04. |
| [../rules/deck.json](../rules/deck.json) · [../tabletop/](../tabletop/README.md) | The physical deck as data, and the print-and-play built from it. |
| [../prototypes/](../prototypes/README.md) | Throwaway experiments and what they found. |
| [../server/](../server/README.md) · [../web/](../web/README.md) | The remote (Elixir/Phoenix) and the terminal (the web client): how to run each. |

## How we work

| | |
|---|---|
| [conventions.md](conventions.md) | Repository layout, readability rules, and the project vocabulary. |
| [workflow.md](workflow.md) | Branching, commit messages, pull requests, versioning, releases. |
| [lifecycle.md](lifecycle.md) | Document statuses, deprecation, and how outdated code, docs, and files are removed. |
| [branding.md](branding.md) | The name is not final: canonical spellings and how to find every use. |
