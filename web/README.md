# web: the terminal

_Status: Current · Last verified: 2026-09-29_

The web client (charter decision 14): Vite, a PWA, plain JavaScript modules and no framework. It is an event-to-screen mapper for the remote's view ([event-screens.md](../docs/design/event-screens.md)): it fetches the view, renders it, and sends packs. It keeps no game state of its own, so opening a game a week later is the same as opening it a second later (charter decision 9).

## Run it

The remote is the Phoenix app in [`../server`](../server). Start it, then the client, which proxies `/api` to it:

```
cd server && mix phx.server
cd web && npm install && npm run dev
```

Open http://localhost:5173. Until sign-in (M8) it is a hotseat client: the people at the device take the human seats, and the remote plays the bots.

## Checks

CI runs all three; so should you before pushing.

```
npm run format:check   # Prettier is law (conventions §2)
npm test               # Vitest, tests beside the code
npm run build          # the PWA in dist/
```

## Where things are

| File                          | What it is                                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| `src/main.js`, `src/route.js` | The entry and the addresses (`#/`, `#/g/<id>/<player>`)                                        |
| `src/api.js`                  | The remote's JSON API; errors carry the remote's own words                                     |
| `src/dom.js`                  | Building DOM without innerHTML, so other players' text is only ever text                       |
| `src/brand.js`                | The name, defined once (`// BRAND`, [branding.md](../docs/branding.md))                        |
| `src/cards.js`                | Cards as the printed deck draws them, colored from `rules/deck.json`                           |
| `src/table.js`                | The Table: `main`, pointers, every seat's public state                                         |
| `src/moments.js`              | The event-to-screen mapper: a day log becomes moments, one per op, and says which get a screen |
| `src/copy.js`                 | Every coach line, keyed by moment: the one file a translation replaces (event-screens §6)      |
| `src/transcript.js`           | Moments as a terminal prints them: `ana@main $ git push` and Git's output                      |
| `src/start.js`, `src/game.js` | I-Start, and a game as one player sees it                                                      |
| `public/sw.js`                | The service worker: the app's files offline, never the game                                    |
