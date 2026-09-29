# ADR-0001: Prototypes are disposable; specs carry over

*Status: Accepted · Date: 2026-09-29*

## Context

Phase 0 needs software to find out whether the game is understandable and fun: a walkthrough, a play-against-a-bot page, and next a phone-shaped one-event-per-screen version. These are built fast, largely with AI, and optimised for answering a question, not for being maintained. The charter's conventions exist to keep the *product* readable; applying the full weight of them to scrap code slows the learning down, while letting scrap code drift into the product is how unreadable software starts.

## Decision

Prototypes live in `prototypes/`, one folder each, and are **thrown away**. The production client and server are **rewrites** that implement the specifications in `docs/design/` — the event model, the screen inventory, the visual language, the copy, the rule findings — which prototypes exist to produce and refine. Nothing in production may import from, copy from, or be "cleaned up from" a prototype; if a piece of prototype code is worth keeping, its *idea* is written into a spec and the code is written again against that spec.

`prototypes/` is deleted at the end of Phase 2. Its READMEs' findings are moved into `docs/` before that.

## Alternatives considered

- **Evolve the best prototype into the product.** Rejected: the prototypes are single-file pages with a scripted bot and no persistence; the product is a multi-player event-sourced server with a real client. The shapes don't meet, and "evolve" would mean carrying every shortcut forward.
- **No prototypes; build the product directly.** Rejected: the charter's Phase 0 exists because the rules are the unknown, and the cheapest way to test rules is throwaway software and paper.
- **Hold prototypes to full conventions.** Rejected: it doubles the cost of every experiment for code that will be deleted. They keep the readability rules (someone must be able to see the rules in the engine) and drop the rest.

## Consequences

- Specs in `docs/design/` become the real deliverable of Phase 0–1, and they must be good enough to rewrite from. Every prototype ends with a "findings" section that feeds them.
- There will be a visible moment where a working prototype is discarded and the same thing is built again. That is the plan, not a failure.
- `prototypes/` gets a lighter review: readability of the engine, the fixed vocabulary, no dependencies. Not the 300-line cap, not the PR size cap.

## Supersedes / superseded by

None. Refines charter §5 (Phase 0) and conventions §1 (repository layout).
