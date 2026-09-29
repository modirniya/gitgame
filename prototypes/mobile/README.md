# mobile

*Status: In progress · Last verified: 2026-09-29*

**Question:** does one-event-per-screen on a phone make the game clearer and more fun than the table view?

**Spec:** [docs/design/event-screens.md](../../docs/design/event-screens.md). **Plan:** [PLAN.md](PLAN.md).

**Test:** `node smoke-test.js` (auto-plays 800 games through the pure engine and checks the event stream).

## Files

- `engine.js` — the rules as a pure function: `createGame({ seed, guided })`, `apply(state, action) → { state, events }`, `scores`, `legalActions`.
- `bot.js` — `plan(state, id)` returns `{ action, why }`, the desktop policy; `botStep(state)` plays one op and wraps it in a `BotActed` event.
- `copy.js` — every string the player reads, keyed by event or reason.
- `smoke-test.js` — the test above.

## Findings

To be filled in when the prototype is done.
