# AI disclosure

This project is built with substantial help from AI. We would rather say so plainly than have you work it out.

## What the AI does here

- **Design partner.** The game concept, the round-resolution model, and the project charter were developed in conversation with Anthropic's Claude, with a human deciding at every step.
- **Author of drafts.** Most documentation, and much of the code once there is code, is first written by Claude (through Claude Code) and then read, edited, tested, and accepted by a human maintainer.
- **Not a decision maker.** The AI proposes; the maintainer disposes. Every locked decision in the charter was made by a person.

## Who is accountable

NeuEra LLC and its maintainers. A human has read every line that lands on `main` and is responsible for it as if they had typed it. "The AI wrote it" is never an explanation for a bug, a license problem, or a rude comment.

## How AI-written work is marked

- **Commits.** When AI produced a substantial part of a change, the commit carries a trailer naming the model, for example
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
  The trailer is a record of provenance, not a claim of authorship rights — the AI holds no copyright, and the human committer is the author for licensing purposes.
- **Pull requests.** The template asks how AI was used. Answer honestly; "none" is a fine answer.
- **This file** stays at the repository root for as long as AI is used, and is updated if how we use it changes.

## For contributors

AI-assisted contributions are welcome under three conditions:

1. **You understand the change.** You can explain every line in review without asking the AI. If you can't, it isn't ready.
2. **You disclose it.** Fill in the AI field of the pull request template.
3. **You have the right to contribute it.** You are responsible for making sure nothing you submit is copied from a source whose license is incompatible with AGPL-3.0, whichever tool produced it.

## Why we are careful about it

AI can produce a lot of plausible code quickly. That is a risk to a project people are supposed to read, review, and trust. Two documents exist mainly to counter it: [docs/conventions.md](docs/conventions.md) keeps the codebase small and legible, and [docs/lifecycle.md](docs/lifecycle.md) keeps it from silting up. Tests are the safety net: the resolver's property tests are a hard gate before anything goes public.

If you find something that looks confidently wrong, that is exactly the kind of bug AI produces. Please open an issue.
