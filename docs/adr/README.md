# Architecture Decision Records

*Status: Current · Last verified: 2026-09-29*

An ADR is a short document that records one decision, the context that forced it, the alternatives that were considered, and the consequences we accept. ADRs are how a person arriving in a year learns *why* the project is the way it is, without asking anyone.

## When to write one

- Anything that changes a locked line of the [charter](0000-project-charter.md).
- A choice between real alternatives with lasting cost: a dependency, a data model, a protocol, a hosting provider.
- A change to the game rules that alters the feel of play, not just a number.

If you are unsure, write one. They're short.

## Rules

- Numbered sequentially, four digits: `NNNN-short-title.md`.
- **Never deleted, never edited after acceptance** except to change the status line. A reversal is a *new* ADR that supersedes the old one, and the old one's status points forward.
- Status is one of: Proposed, Accepted, Superseded by ADR-NNNN, Rejected.
- Written before the code, reviewed in the same PR as the code, or in its own PR if the discussion is the point.

## Template

Copy [template.md](template.md).

## Index

| ADR | Title | Status |
|---|---|---|
| [0000](0000-project-charter.md) | Project charter | Accepted |
| [0001](0001-prototypes-are-disposable.md) | Prototypes are disposable; specs carry over | Accepted |
