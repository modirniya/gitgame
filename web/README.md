# web: the terminal

_Status: Current · Last verified: 2026-09-29_

The web client (charter decision 14): Vite, a PWA, plain JavaScript modules and no framework. It is an event-to-screen mapper for the remote's view ([event-screens.md](../docs/design/event-screens.md)): it fetches the view, renders it, and sends packs. It keeps no game state of its own, so opening a game a week later is the same as opening it a second later (charter decision 9).

## Run it

The remote is the Phoenix app in [`../server`](../server). Start it, then the client, which proxies `/api` to it:

```
cd server && mix phx.server
cd web && npm install && npm run dev
```

Open http://localhost:5173. The first time it opens, the device signs in as a new anonymous player ([ADR-0005](../docs/adr/0005-sign-in-written-fresh.md)). You take the first seat of every game you start; anyone else at the device can take one too (hotseat), and the remote plays the bots.

## Checks

CI runs all three; so should you before pushing.

```
npm run format:check   # Prettier is law (conventions §2)
npm test               # Vitest, tests beside the code
npm run build          # the PWA in dist/
```

## Where things are

| File                          | What it is                                                                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `src/main.js`, `src/route.js` | The entry and the addresses (`#/`, `#/g/<id>[/<seat>]`, `#/r/<id>/<day>`)                                               |
| `src/api.js`                  | The remote's JSON API; errors carry the remote's own words                                                              |
| `src/dom.js`                  | Building DOM without innerHTML, so other players' text is only ever text                                                |
| `src/brand.js`                | The name, defined once (`// BRAND`, [branding.md](../docs/branding.md))                                                 |
| `src/cards.js`                | Cards as the printed deck draws them, colored from `rules/deck.json`                                                    |
| `src/table.js`                | The Table: `main`, pointers, every seat's public state                                                                  |
| `src/moments.js`              | The event-to-screen mapper: a day log becomes moments, one per op, and says which get a screen                          |
| `src/copy.js`                 | Every coach line, keyed by moment: the one file a translation replaces (event-screens §6)                               |
| `src/transcript.js`           | Moments as a terminal prints them: `ana@main $ git push` and Git's output                                               |
| `src/pack.js`                 | The pack editor's model: ops in the remote's shapes, a pull before each push, and each op's cost now and at most        |
| `src/hub.js`                  | I-Hub: `main`, your branch and hand, the actions (greyed with the reason), and the pack as commands                     |
| `src/screens.js`              | The consequence screens: one moment at a time, what it moved, the coach line; continue or skip                          |
| `src/catchup.js`              | What this reader hasn't seen: each closed day's big moments, then today's incident; remembered per device               |
| `src/replay.js`               | A replay: any game day by day, each day the view the remote folds from the log to that day's close                      |
| `src/exit.test.js`            | The Phase 1 exit as a test: a game against the bot through the client's modules, then replayed (needs `GITGAME_REMOTE`) |
| `src/start.js`, `src/game.js` | I-Start, and a game as one player sees it                                                                               |
| `public/sw.js`                | The service worker: the app's files offline, never the game                                                             |
