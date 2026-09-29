# mobile

*Status: In progress · Last verified: 2026-09-29*

**Question:** does one-event-per-screen on a phone make the game clearer and more fun than the table view?

**Spec:** [docs/design/event-screens.md](../../docs/design/event-screens.md). **Plan:** [PLAN.md](PLAN.md).

**Run:** `python3 -m http.server` in this folder, then open http://localhost:8000 at phone size (ES modules need a server; `file://` won't load them).

Add `?seed=123` to replay a shuffle; `?debug` exposes the router as `window.gitgame` for driving a game from the console.

**Test:** `node smoke-test.js` (auto-plays 800 games through the pure engine and checks the event stream).

## Files

- `engine.js` — the rules as a pure function: `createGame({ seed, guided })`, `apply(state, action) → { state, events }`, `scores`, `legalActions`.
- `bot.js` — `plan(state, id)` returns `{ action, why }`, the desktop policy; `botStep(state)` plays one op and wraps it in a `BotActed` event.
- `copy.js` — every string the player reads, keyed by event or reason.
- `router.js` — `screensFor(events)` maps events to screens; the queue, auto-advance and "skip bot".
- `frame.js` — the status bar and the Table sheet, drawn from the state of the screen being shown.
- `view.js` — the card (one component at every size), the `main` strip, pointer chips, ops pips.
- `screens.js` — one render function per screen id in the spec.
- `hub.js`, `outcomes.js` — the hub, and the output screens (screens.js holds the input screens and the registry).
- `motion.js` — the animations of spec §4, FLIP for card movement, off under `prefers-reduced-motion`.
- `index.html`, `styles.css` — the shell and every style, light and dark.
- `smoke-test.js` — the test above.

## Findings

To be filled in when the prototype is done.
