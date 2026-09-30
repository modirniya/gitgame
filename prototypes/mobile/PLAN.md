# Mobile prototype: plan

*Status: Done · Last verified: 2026-09-29 · Executed step by step; the findings are in [README.md](README.md)*

Build the one-event-per-screen version of the game for a phone, against the bot, per the spec in [docs/design/event-screens.md](../../docs/design/event-screens.md). This is a prototype: it answers "is this clearer and more fun on a phone?", it is not the product, and the production client will be a rewrite of the same spec. Spend effort on the **screens, animations and copy** — those are what we are testing — and keep the code plain enough that a reader sees the rules in it.

## Ground rules

- Plain HTML/CSS/JS, ES modules, **no build step and no dependencies**. Open `index.html` from a static server (`python3 -m http.server` in this folder) or the built-in browser.
- Portrait, 390 × 844 baseline, works at 360. Test at that size, not on a desktop window.
- Start from `../play-vs-bot/index.html`: its engine, bot policy and coach copy are the first draft of everything. Copy, don't import.
- Follow [docs/conventions.md](../../docs/conventions.md): fixed vocabulary, files under ~300 lines, no speculative abstraction, `why` comments only.
- Every step below ends with the smoke test passing. Do not accumulate red.

## Files

```
prototypes/mobile/
├── README.md        question, status, how to run, findings (filled in at the end)
├── index.html       shell: frame (status bar, table tab), a <main> the router renders into
├── styles.css       tokens (light + dark), card component at three sizes, screen layouts, animations
├── engine.js        pure rules: createGame(seed), apply(state, action) → { state, events }, scores(state)
├── bot.js           plan(state, 'bot') → action + reasoning; step-by-step driver
├── copy.js          every string, keyed by event; Git's own messages verbatim
├── screens.js       one render function per screen id in the spec; input screens return actions
├── router.js        turns the event stream into a screen queue; handles auto-advance and "skip bot"
├── guide.js         the guided-first-game overlay
└── smoke-test.js    node: 800 auto-played games + event-stream invariants (see Tests)
```

## Steps

1. **Engine as a pure module.** Port the resolver from the desktop prototype into `engine.js` with this shape: `createGame({ seed, guided })`, `apply(state, action)` returning a new state and an ordered list of events from the table in the spec §2, `scores(state)`, `legalActions(state)` (each with its cost and, if disabled, the reason — the hub renders these directly). Seed the shuffle and the die with a small seeded RNG so a game is reproducible from its seed. *Done when:* the smoke test auto-plays 800 games through `apply` only, with zero errors, the pointer invariant holds, and replaying a game's actions from its seed reproduces its event log exactly.
2. **Bot as a module.** `bot.js` exports `plan(state)` returning `{ action, reasoning }` — the desktop policy plus the fixes already made (push before tag; revert only at the tip; one reflog per victim is the engine's job). Reasoning strings are third person and come from `copy.js`. *Done when:* a competent scripted player beats the bot about 3:1 and a random one loses about 20:1, as before.
3. **Router and frame.** `router.js` keeps a queue of `{ screenId, payload }`. After each `apply`, map events to output screens per spec §2 and push them; when the queue is empty and it is the player's turn, show `I-Hub`. Auto-advance for `O-BotTurn`/`O-BotStep`/`O-CI` with tap-to-advance and "skip bot". The frame shows the status bar and the Table sheet. *Done when:* a whole game can be played through the queue with placeholder screens that only print their event.
4. **Screens, in this order** (each one replaces its placeholder; commit after each group): I-Start, O-Incident, O-YourTurn, I-Hub → I-Stage, I-Commit, O-Pushed, O-Rejected → I-Pull, O-Pulled, I-Conflict, O-Resolved → I-Target, O-Blamed, O-Reverted → I-Force, O-Forced, O-Reflog → I-Tag, O-TurnSummary → O-BotTurn, O-BotStep, O-Behind → O-CI, O-Scoreboard → Table sheet. *Done when:* every event in spec §2 has a screen and no screen shows two questions.
5. **Animations.** The list in spec §4, as CSS transitions driven by FLIP for card movement (measure, move in DOM, invert, play). `prefers-reduced-motion` disables them all. *Done when:* push, reject, pull, conflict, force, reflog, blame and CI each visibly show their mechanism at 390 px without layout jumps.
6. **Guide layer.** Port the guided first game as an overlay that highlights one element per step (spec §3, "Guided first game"), including the bot's head-start commit and the skip-the-pull fallback. *Done when:* the guided sequence completes in a scripted test and the pull lesson lands in >95% of seeds.
7. **Copy pass.** Move every string to `copy.js`; read every screen aloud once; apply the rules in spec §6.
8. **Mobile check.** In the built-in browser at the mobile preset: no horizontal page scroll, safe-area respected, all targets ≥ 44 pt, dark theme legible, a full game playable with thumbs only. Fix what fails; then fill in `README.md` findings and the spec's open questions with what you learned.

## Tests

`node smoke-test.js` must cover: (a) 800 auto-played games, competent and random, zero errors; (b) pointer invariant `1 ≤ ptr ≤ main.length` after every action; (c) determinism — same seed and action list → identical event log; (d) event coverage — every event type in spec §2 is emitted at least once across the run; (e) the guided sequence from step 6. No browser tests; the one browser check is step 8, done by hand.

## Findings to record when done

In `README.md` here and, if they change a rule, as a `rules:` change in `docs/design/base-rules.md` plus `rules/deck.json`:

- Which screens people tap through without reading (candidates to merge or drop).
- Whether the bot's per-op screens are watched or skipped.
- Whether `O-Behind` still helps in game three.
- Any rule the screens made awkward — that is a rule finding, not a UI finding.

## Not in this prototype

Online play, persistence, accounts, more than two players, tickets, roles, sounds, a build system, a framework. If any of these seems necessary to answer the question, the question is wrong; stop and say so.
