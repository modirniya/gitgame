# ADR-0011: Git Game is non-commercial, permanently

*Status: Accepted · Date: 2026-10-30*

## Context

The charter was written with a revenue plan (decision 19): the hosted service first, then Orgs/Teams priced per seat, then a physical box through Kickstarter. Phase 4 was "first revenue", §6 counted a "first paying org", and priority 5 was revenue. Since then the project has said the opposite in public: the README and TRADEMARKS.md say Git Game is non-commercial and stays free and copyleft, and the name is used with Software Freedom Conservancy's permission for a free project. A reader of the repository found two models, and only one of them is the project's.

The maintainer's position is that Git Game is non-commercial and stays copyleft. A plan that is never going to happen should not be written down as one, and ADR-0010's choice of licence leaned on it ("a use the project wants", "the physical box relies on").

## Decision

Git Game is non-commercial, permanently. Nothing in it is sold, now or later: not the hosted game, not features for teams, not the deck, not a box. The code stays under the AGPL-3.0-or-later and the pages and the deck under CC BY-SA 4.0, so anyone else keeps every right those licences give, including commercial use of their own copies.

This amends the charter:

- **Decision 19** (revenue plan) is replaced by: *The hosted service at gitgame.online is where people play, free. Features for teams (private spaces, team leaderboards, a workshop mode, a Slack bot) are built as free features, when the game earns them. The print-and-play deck is the physical game, free to download and print. There is no paid tier, no pricing, no crowdfunding and no advertising.*
- **§3**, the row "Closed source, or open source funded by donations": what we chose instead is *AGPL, hosted for free, and nothing sold*, because secrecy protects nothing here and the game is meant to be played, not monetised.
- **§4 priority 5** (revenue) is removed. Priorities 1–4 stand.
- **§5 Phase 4** becomes *Teams*: private spaces, team leaderboards, workshop mode, a Slack bot, all free. **Phase 5** becomes *The deck*: the print-and-play PDF, to the print-and-play checklist, free.
- **§6 Phase 4** is measured by team invites per completed game; "first paying org" is removed.

It also amends ADR-0010's rationale, not its decision. The pages and the deck stay under CC BY-SA 4.0, and CC BY-NC-SA stays rejected, for this reason instead: a non-commercial clause would take a right away from everyone else (a trainer using the deck in a paid workshop, a library or a shop printing it) to protect a business this project doesn't have. Non-commercial is a promise about what the project does, not a restriction on what others do with free work. NC licences also aren't free licences by the FSF's or Debian's definitions, and would sit badly beside the AGPL.

## Alternatives considered

- **Keep the revenue plan as an option for later** — it is what made the charter and the README disagree. An option nobody intends to take is a claim the project would have to explain away to every reader, to contributors, and to the trademark holder.
- **Non-commercial "for now"** — the same problem, postponed. A project that may start selling later asks contributors and players to trust a change of mind they can't see coming.
- **Make the content non-commercial too (CC BY-NC-SA, or a commons clause on the code)** — restricts other people, not the project, and leaves the code and deck non-free. Rejected above.

## Consequences

- No public document describes Git Game as something that will be sold. The charter's superseded lines are struck through and point here; `/teams` says features for teams are free; the privacy policy and terms say there is nothing to buy.
- The project has no income, so its costs are what the maintainer chooses to carry. The hosting stays small (ADR-0007, ADR-0008), and a feature that would need money to run waits for a way to run it free.
- Contributors give their work to a project that will not sell it. The licences already let anyone else sell their own copies; that stays true, and is not a loophole.
- Features for teams are still welcome, and still the growth loop (priority 4): they are built free, or not at all.

## Supersedes / superseded by

Amends the charter ([ADR-0000](0000-project-charter.md)): decision 19, §3, §4 priority 5, §5 Phases 4–5 and §6 Phase 4. Amends the rationale of [ADR-0010](0010-pages-and-deck-under-cc-by-sa.md).
