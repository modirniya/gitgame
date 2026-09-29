# Conventions

*Status: Current · Last verified: 2026-09-29*

These rules exist because this codebase is written quickly, largely with AI assistance, and must stay readable by a person who has never spoken to that AI. When in doubt, optimise for the reader.

## 1. Repository layout

```
.
├── docs/        Everything a human reads: ADRs, design, these guides
├── rules/       Rules as data — cards, costs, incidents (Phase 1)
├── server/      Elixir / Phoenix — the remote (Phase 1)
├── web/         Vite client — the terminal (Phase 1–2)
├── tabletop/    Print-and-play files (Phase 5)
├── prototypes/  Throwaway experiments, one folder each; deleted at Phase 2 (ADR-0001)
├── scripts/     Repository maintenance scripts, each self-documenting
└── .github/     Issue and PR templates, workflows
```

- A directory is created when its first real file exists — never in advance, never as a placeholder.
- Depth stays at three levels or fewer below any of the roots above. If you need a fourth, the module is too big.
- Tests live next to the code they test (`server/test/` mirrors `server/lib/`; `web/src/foo.test.js` beside `web/src/foo.js`).
- There is no `misc/`, `utils/`, `old/`, `tmp/`, or `v2/` anywhere. Those names are where readability goes to die.

## 2. Files

- **One file, one idea.** The file name says what it is; the first comment or docstring says why it exists, in one paragraph.
- **Soft cap of 300 lines** per source file. Past that, split by responsibility, not by line count.
- **Formatters are law**: `mix format` for Elixir, Prettier for the web client, both enforced in CI. Style is not discussed in review.

## 3. Code

- **Vocabulary is fixed** (see §5). A pack is a `pack`, never a `turn`, `move`, `submission`, or `action_batch`. Consistent names are how a stranger reads the code without a guide.
- **Explain why, not what.** Comments that restate the code are deleted in review. Comments that explain a non-obvious reason, a Git subtlety, or a rejected alternative are treasured.
- **No speculative abstraction.** Three similar lines are better than a helper for a case that doesn't exist yet. Abstract on the third real use, not the first imagined one.
- **Rules are data.** Card definitions, op costs, incidents, and timings live in `rules/`, not in code. A playtest tweak must not need a deploy.
- **Real Git output.** Error messages and terminology are Git's own (`! [rejected] non-fast-forward`, `Already up to date.`). If unsure what Git says, run Git.
- **Delete, don't disable.** No commented-out code, no `if false`, no dead feature flags. Git history is the archive (see [lifecycle.md](lifecycle.md)).
- **The resolver is pure.** State in, events out, no side effects. Everything else is plumbing around it.

## 4. Pull requests, size, and AI

- One concern per PR. Under ~400 changed lines, excluding generated files and lock files.
- AI is good at producing a thousand lines that each look fine. Reviewers will ask "why does this need to exist?" of every new module. Have an answer that is not "the AI added it".
- Every new module, config key, or script must be reachable from a doc or a doc index. Unreachable things are deleted at the next gardening pass.

## 5. Vocabulary

Use these words, and only these, in code, docs, and UI.

| Term | Meaning |
|---|---|
| **remote** | The server-side game state: `main`, every player's pointer, the day log. The thing that resolves packs. |
| **day** | The unit of play. Every player sends one pack per day. Length is set at game creation. |
| **pack** | A player's ordered list of ops for one day. |
| **op** | One action in a pack: `commit`, `push`, `pull`, … Local ops never interact with other players; remote ops are serialized by the remote. |
| **budget** | The 3 ops a player may spend per day. |
| **tip** | The newest commit on `main`. |
| **pointer** | Where a player's local branch thinks `main` is (`origin/main`). |
| **trap** | A face-down command armed in your own pack that fires during someone else's (`reflog`, `stash`). |
| **incident** | The public event flipped at the start of each day. |
| **day log** | The public record of what every pack did today. |
| **release** | The end of the game: CI runs, blame is assigned, scores are counted. |
| **grudge / sin / merge token** | The three penalty tokens from the base rules. |

Never: turn, round, move, action (for a pack), session (for a game), board (for the remote).

## 6. Documentation

- Every doc in `docs/` carries a status line (see lifecycle.md) and links to what it depends on.
- Write for someone who arrived from a search engine. No "as discussed", no "see above" across documents.
- Prefer one good doc to three partial ones. If two docs overlap, merge them and delete one.
