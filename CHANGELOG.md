# Changelog

All notable changes to this project are recorded here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [Semantic Versioning](https://semver.org/).

Every user-visible change lands under *Unreleased* in the same pull request that makes it. A release moves the section under a version heading with the date.

## [Unreleased]

### Added
- Repository scaffold: license (AGPL-3.0-or-later), governance files, issue and PR templates.
- Project charter as ADR-0000, with the decisions locked on 2026-09-29 and the alternatives set aside.
- Design docs: tabletop base rules and the online round-resolution model (days, packs, remote).
- Conventions, workflow, lifecycle, and branding guides.
- `scripts/brand-audit.sh` to list every use of the working name.
- Tabletop deck as data (`rules/deck.json`) and a print-and-play PDF generator (`tabletop/build.py`) for the Phase 0 playtest.
- `prototypes/play-vs-bot`: a playable two-player prototype against a bot with a guided first game, hints, undo and a smoke test; its rule findings are in its README.
- ADR-0001: prototypes are disposable, specs carry over. `docs/design/event-screens.md` specifies the one-event-per-screen mobile flow; `prototypes/mobile/PLAN.md` is the build plan for it.
- `prototypes/mobile`: the one-event-per-screen phone prototype against the bot, with a pure event-emitting engine, every screen in the spec, animations, the guided first game, a playtest recorder and a smoke test. Its findings answer the spec's open questions provisionally and propose three rule changes: no merge token for a fast-forward pull, a hand limit, and making force-push reachable in a two-player game.
- CI: a GitHub Actions workflow runs the mobile prototype's smoke test on every pull request and on pushes to `main`.
- ADR-0002: the human playtest moves to a beta of the real product; the rules stay draft (v0.x) until people have played it.
- `prototypes/packs`: a simulation of the online day/pack model that answers playtest questions 1 and 2 provisionally. Sending first, not last, dominates under arrival order (61:39); batching at the deadline is fair but doubles conflicts. Paying for a rejected push stays. Answers are recorded in `round-resolution.md` §7.
- `docs/design/phase-1-plan.md`: the build plan for Phase 1 (server skeleton, rules, resolver, event log, days, views and bots, hotseat web client) and the beta, with a "done when" for each milestone.

- `server/`: the Phoenix API app (M1): Postgres through Ecto, `GitGame.Brand` as the one definition of the name, and `GET /api/health`, which also checks the database. CI gains a server job (format, compile with warnings as errors, test against Postgres 17).

- `GitGame.Rules` (M2a): the server reads and validates `rules/deck.json` and `rules/online.json`, failing loudly on any missing, unknown or mistyped key. `deck.json` gains stable card ids, machine-readable incident effects and a `scoring` section; `online.json` gains the cards switched on for online play (the tested core, plus two quiet days).

- `GitGame.Game` and `GitGame.Seeded` (M2b): the state of one game and its deal, with every random draw derived from the game's seed and its purpose, so a game replays from its seed alone.

- `GitGame.Ops` and the local ops (M2c): the one interface the resolver runs an op through (its cost at the moment it runs, then its effect as events, or a failure in Git's words), with `add`, `commit` and arming a trap.

- The remote ops (M2d): `push` (free with nothing to push, rejected non-fast-forward from behind, Flaky CI's die on the day's first push) and `pull` / `pull --rebase` (free when up to date; conflicts settled by the declared strategy; a merge token only when unpushed commits were merged).

- The command cards (M2e): `git blame` (a live bug counts against its author), `git revert` (from the tip, +1) and `git push --force` (a sin; an armed `reflog` restores all of its owner's erased commits on top; an erased revert revives its bug). Under Stack Overflow Is Down every command fails, is paid for, and keeps its card.

- The release (M2f): `git tag v1.0` once `main` is the release size; CI flips every commit and counts each unblamed live bug once; production down at four bugs, when the least blame wins; scores broken down by `rules/deck.json`'s scoring, with a face-down bug counting as clean while the game runs. `online.json` gains the cost of `tag` and drops an unused `command_card` cost.

- The resolver (M3a): `GitGame.Resolver` opens a day (incident, draws) and closes it, resolving every pack in the seeded order (or arrival order, as a setting), each to its budget; then the hand limit, the final day's CI, and the next day. Cards that leave play now go to a discard pile instead of vanishing.

- The resolver's property tests (M3b), under both resolution orders: after every day of thousands of generated games, every pointer is on `main`, every card is in exactly one place, and no pack overspends; every game releases by its final day; and replaying a game's packs from its seed reproduces it exactly. They found one bug on their first run: a force-push that erased an already-overwritten commit lost its cards.

- Absence in the resolver (M3c): no pack by the time a day closes is an empty pack; two in a row and the player has left the company, sending no more packs and drawing no more cards, while their commits stay on `main` and take blame at the release.

- The event log (M4a), ADR-0004: a game is a row (seed, seats, day length, a snapshot of its rules) and an append-only log of what players did (`game_created`, `pack_sent`, `day_closed`), enforced by a database trigger; its state and day logs are folded from the log through the pure resolver. `GitGame.Games` creates games, takes packs (a pack for a version that has moved on is rejected, `! [rejected] (fetch first)`), and closes each day once. `GitGame.Games.Pack` admits only the online game's ops, in their exact shapes.

- The games API (M4b): `POST /api/games`, `GET /api/games/:id` and `POST /api/games/:id/packs`. A game's public view shows what everyone at the table may see: `main` as announced (a face-down commit never says whether it is a bug), pointers, tokens, card counts, the live score, the incident, and who has sent today's pack. A stale pack is `409` with Git's `(fetch first)`.

- Days on a clock (M5), with Oban: each day's deadline is when it opened plus the day length (24h, 5m or 60s, from the rules); a job enqueued in the transaction that opens the day closes it then, or it closes at once when every player still in the game has sent a pack. Running late, twice, or after the game ends, the job does nothing. The public view shows the deadline.

- Per-player views (M6a): `GET /api/games/:id?player=ana` shows ana her own hand, staging area, local branch and traps, and every day log as she may see it: others' draws, staged cards and hand-limit discards as counts, their commits as "committed", their traps not at all, and a failed local op without the message that would name their cards. A property test checks, over generated games, that no view ever names another player's private card or trap, or says whether a face-down commit is a bug.

- Bots (M6b): `GitGame.Bot` writes a day's pack from its own view only, as the same JSON a client sends, playing the policy the simulations found (a pull before every push, declared conflict strategies, blame, revert, force-push over one big commit, arming reflog). `POST /api/games` takes `bots`; a bot sends its pack as each day opens, so a game of bots plays itself out at once.

- The web client's first screens (M7a): `web/` is Vite and a PWA with no framework. Start a game against bots from a phone or a laptop and see the table (`main` with every pointer, each seat's score, counts and tokens) and your hand. `npm run dev` proxies `/api` to the server. CI formats, tests and builds it.

- Live refetch and replay on the server (M7b). `GET /api/games/:id/live` is a Server-Sent Events stream that says only `refetch`, whenever the game's log grows and after the write has committed, and ends at the release (charter decision 9). `GET /api/games/:id/days/:day` replays the game as it stood when that day closed, folded from the log up to there. The view now says which seats are bots and what each op and command costs under the game's own rules.

- The day log as a terminal (M7c): the client maps every event the remote sends to a moment, one per op (`ana@main $ git pull -X theirs`, then `CONFLICT (content): …`), each with a coach line in the second person. Rejections, conflicts, blame, force-pushes, reflogs, the tag and CI always get a screen of their own; a push and a pull only the first time each happens in a game, as the mobile prototype found; the rest are lines in the transcript. The game screen shows the last day's log.

- Writing a pack in the browser (M7d): the hub shows `main`, your branch (unpushed commits face-up to you) and your hand, and one row of actions, each greyed out with the reason when it can't be played. The pack is a list of commands (`git pull --rebase -X ours`), with a pull written before each push by default and each op's cost as the remote will charge it: now, and at most if someone else pushes first. A conflict is flagged before you send. The Table is a sheet on phones and a panel on wide screens. The view now carries the pack's op limit and the default conflict strategy.

- Playing in the browser as the day happens (M7e): opening a game shows what happened since you last looked, one screen per big moment and then today's incident with your draws, whether that was a minute or a week ago. The client watches the game's `refetch` stream and fetches again when it says so. Hotseat: after your pack is sent, the device is passed to the next person who owes one, with your hand off the screen. A finished game ends on CI and the scoreboard.

- Replays, and the Phase 1 exit (M7f): any game can be replayed day by day (`#/r/<id>`), each day the view the remote folds from the log up to that day's close, with that day's log as a terminal. CI's new exit job starts a real server and plays a whole game against the bot through the client's own modules, then replays it and checks every day against the game as it ended.

- ADR-0005: sign-in written fresh. GitHub OAuth for accounts, anonymous players by default, server-side sessions in an HttpOnly cookie, and seats owned by players; no Firebase, nothing lifted from RPS.

- Players and sessions (M8a): `POST /api/players` makes an anonymous player with a generated handle (`quiet-otter-42`) and signs the device in, with no form and no account. A session is a random token in an `HttpOnly`, `SameSite=Lax` cookie, stored only as its hash, extended while in use and revocable (`DELETE /api/session`). Writes from another site's pages are refused.

- Seats belong to players (M8b): a game is started by a signed-in player, who takes the first seat under their handle and holds the seats of anyone else at their device (hotseat). The API shows a game only from a seat you hold, and takes packs only for one; everyone else gets the table's view, and `?player=` is gone. The client signs a new device in anonymously on first open, with no form.

- Linking GitHub (M8c): `GET /api/auth/github` runs GitHub's web flow with `state` and PKCE, asking for no scopes; GitHub's token is used once to read the public profile and dropped. A new account is linked to the device's anonymous player, games and all; the same account on another device signs it in as the same player and brings over that device's anonymous seats. Off unless `GITGAME_GITHUB_CLIENT_ID` and `GITGAME_GITHUB_CLIENT_SECRET` are set.

- Who you are, in the client (M8d): the start screen shows your handle, and once GitHub is linked, your login and avatar and a way to sign out. An anonymous player gets "link GitHub" instead, and a nudge on the scoreboard after a game: their games live in this browser alone. A GitHub trip that didn't finish says so once.

- Rooms by link, on the server (M9a): `POST /api/rooms` opens a room with an eight-character code to share; others join by it, the host sets the bots and day length and starts the game, and every member takes a seat under their handle in the order they joined, then the bots. Five seats at most; closed once started. `GET /api/rooms/:code/live` says `refetch` whenever the room changes.

- Rooms in the client (M9b): the start screen's first button plays the bot now, in one tap; the second opens a room and shows its link to share. Whoever opens the link can join; the host sets the bots and day length and starts, and the room's stream takes everyone to the game. Setting up a hotseat game by hand moved under "more".

### Changed
- Rules v0.2. ADR-0003: a day's packs resolve together at the deadline, in a seeded random order, instead of on arrival. A plain pull takes a merge token only when it merges unpushed commits. Hand limit of 10. The deck has 5 `push --force` and 4 `reflog` cards (was 3 and 3), 33 command cards in all. The online rules are data in `rules/online.json`; `round-resolution.md` is spec v0.2 with its five ambiguities settled; the print-and-play PDF is rebuilt.

### Fixed
- A force-push answered by a reflog printed the restored commit as its new tip (`+ b0ba026...b0ba026`). The forced-update line now shows what the force-push itself made the tip, as Git does; the reflog is its own event.
