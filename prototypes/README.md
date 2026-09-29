# Prototypes

*Status: Current · Last verified: 2026-09-29*

Throwaway software that exists to answer a question. **Nothing in this directory ships, and nothing in the production code is derived from it.** What survives a prototype is what it taught us, written down in `docs/` — the event model, the screen inventory, the copy, the rule findings. See [ADR-0001](../docs/adr/0001-prototypes-are-disposable.md).

| Prototype | Question it answers | Status |
|---|---|---|
| [play-vs-bot/](play-vs-bot/) | Can one person understand the game by playing it against a bot, with a guide and hints? | Done. Single-file desktop page with a real resolver, a scripted bot, a guided first game, hints, undo and a live score. `node smoke-test.js` auto-plays 800 games. |
| [mobile/](mobile/) | Does one-event-per-screen on a phone make the game clearer and more fun than the table view? | Built; awaiting a human playtest. Every screen of [the spec](../docs/design/event-screens.md) against the bot, with animations, the guided game and a playtest recorder. Provisional answer: clearer for the moments, too slow for the routine (about 105 screens a game). Findings, including three rule findings, in its README. |

## Rules for this directory

- A prototype is one folder with a README stating the question, the status, and how to run it.
- No build steps, no dependencies beyond a browser and node for tests. Plain files, open `index.html`.
- Prototypes may share code by copying, never by importing each other. Copy-paste is honest here; a shared module would be a library, and we don't ship libraries from a scrap heap.
- The conventions on readability still apply: someone must be able to read the engine and see the rules in it.
- **Disposal:** a prototype is deleted the moment the production code covers its question (the whole directory goes at the end of the charter's Phase 2). Its README's findings are moved into `docs/` first. Git history keeps the rest.
