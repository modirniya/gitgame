# Changelog

All notable changes to this project are recorded here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [Semantic Versioning](https://semver.org/).

Every user-visible change lands under *Unreleased* in the same pull request that makes it. A release moves the section under a version heading with the date.

## [Unreleased]

### Added
- The game's view carries, for each closed day, `main`, the pointers and the scores as the day opened (`opened`), so a client can draw the table at every step of the day's playback (M15f). Replays carry them too.

### Changed
- The game looks like the mobile prototype (M15c): prose in a sans-serif and Git in monospace; cards with a colored band saying what they are, the BUG tag where a fanned hand can't hide it, and face-down commits as a hatch showing their hash; `main` with each commit labelled by who pushed it and what it announced, its tip marked, and the pointers as chips; the Table's seats with their tokens. The landing page and its link preview follow.
- A player's first game against the bot is dealt so that its first day is a full one, with a clean card to play, and their pack resolves first, so their first push lands (M15h). The remote chooses the game's seed; the rules are those of any game.

### Fixed
- Git's output wraps on a phone instead of hiding the end of a long line behind a sideways scroll (M15a).
- A pull's conflict strategy is offered by what it does (keep theirs, keep mine, keep both by hand) and printed as Git's flag, which swaps `ours` and `theirs` under `--rebase`; keeping both prints no flag, as in Git. What a rule took (a dropped or crossed-out commit, a merge token, what a force-push erased) is a `#` comment, not a line in Git's voice, and a failed command names its target (M15a).
- A commit starts with a real message for the files staged, with others to pick from, instead of `git commit -m ""` (M15a).
- A pack can tag v1.0 only once (M15a).
- A pull whose conflict is settled by `-X ours` or `-X theirs` prints what Git prints: `Auto-merging` and a merge, or under `--rebase` the commits it dropped and `Successfully rebased`, rather than a CONFLICT and, when `-X theirs` took your only commit, a `Fast-forward`. CONFLICT is printed only for `--resolve`, resolved by hand, and a `pull --rebase` with nothing of yours is a fast-forward, as in Git.
- A failed `git blame` or `git revert` names its commit in the day log, and the bot no longer blames a commit that its own force-push erased earlier in the same pack, which failed with `fatal: no such commit`.

## [0.2.1] - 2026-09-30

### Changed
- The game's page at `/play` asks search engines not to index it (`noindex`), and leaves the sitemap: a search lands on the landing page, whose "play" leads in. Links to `/play` work as before.

## [0.2.0] - 2026-09-30

gitgame.online becomes a landing page for the public launch, and the game moves to `/play` (ADR-0009).

### Added
- A landing page at gitgame.online (ADR-0009): what the game is, how a day plays, and questions answered, as plain HTML that search engines read without running anything, with a title and description, Open Graph and X previews (a 1200×630 image), structured data, `robots.txt` and a sitemap. "play" leads to the game at `/play`.

### Changed
- The game moved to `/play` (ADR-0009), so gitgame.online can be the landing page. Every link the game, its emails and its notifications write points to `/play`, room links included, and links from before the move still arrive: those with a query (`/?via=…`) by a redirect, and those with only a hash (`/#/room/…`) by the landing page's script. The installed app opens at `/play`.

## [0.1.4] - 2026-09-30

### Added
- A feedback box at the end of every game (M13b): the scoreboard takes a note of up to 1000 characters for the maintainer, one per player and game, which they can change later. Only someone who held a seat can leave one, and only once the game is over; nobody else sees it. The beta report counts the notes, and `--feedback` prints them.

### Fixed
- A finished game opened by someone who held no seat in it (a shared link, or a room's "watch the table" after its game) stayed on `$ git fetch`: the scoreboard looked for the reader's seat. It now shows the scoreboard.

## [0.1.3] - 2026-09-30

### Added
- The beta report reads the deployment (M13a): `bin/beta_report` in the release image prints what `mix gitgame.beta_report` prints, and both take `--since YYYY-MM-DD` to count only the games started that day or later, and the visits and replays marked since, so games played while the beta was built don't count as strangers'.

### Fixed
- Every command the release image ran, the server's start included, printed an Erlang warning about a missing `libsctp` first; the image now has the library, so `bin/beta_report --json` prints only JSON.

## [0.1.2] - 2026-09-30

### Changed
- Sending a pack that leaves some of the day's ops unspent now asks first: the hub says how many are left and what could still spend them ("# 2 of today's 3 ops unspent: you could still add, push"), and "send anyway" sends it. An empty pack can still be sent.

### Fixed
- "main has 1 commits": the tag's reason and its error now say "1 commit".

## [0.1.1] - 2026-09-30

Fixes found playing the live site as a newcomer would.

### Fixed
- "Remind me when my pack is due" showed only while today's pack was in, so it never appeared when yours was the last pack in (in every 24-hour game against the bot): the day closed on your send. It now shows once you've sent a pack in the game, as ADR-0006 says.
- Typing a commit message and then tapping "send pack" didn't send the pack: leaving the field redrew the hub under the tap. The message is now kept as it is typed.
- The guided first game, on a first day with only 2 ops (Standup Ran Long), had you push after add and commit had spent them, then send a pack whose push didn't run. It now stops at the commit and says it waits for another day.

## [0.1.0] - 2026-09-30

The first version on the hosted service: the beta ADR-0002 makes the playtest, live at https://gitgame.online.

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

- Your games (M9c): `GET /api/games` lists every game you hold a seat in, with the ones waiting on your pack first, and the start screen shows them: who each is against, what day it is, and "your pack is due" where it is.

- Beta telemetry (M12): the server marks what a game's log can't hold, a player's visit (once a day, with where it came from once notifications exist) and a replay opened, and `mix gitgame.beta_report` prints what ADR-0002 promises the beta records: games started, released and finished by people, when packs were sent against how their pushes went, failed pushes and what the player did next, absences and who left, replays, and players who came back or played again. People's seats only; nothing is shown to players.

- Rate limits (M12c): new players per address, and games and rooms per player, are capped per hour, answered with `429` and `retry-after`, so a script can't mint players or games without end (ADR-0005).

- One image, one origin (M11a): the server serves the built client at `/`, with a Content Security Policy, from the same origin as the API. A root `Dockerfile` builds the client, the release and the rules into one image that migrates its database before serving, and CI builds that image, runs it against Postgres and plays a game on it. Where it runs is still to be decided.

- Reminders (M10a): in games with 24-hour days, when a day opens (and again with a quarter of it left) whoever's pack isn't in gets "your pack is due", and when a game is released everyone in it hears so; at most once per game a day on each channel, however many jobs run. The channels themselves, Web Push and email, come next (ADR-0006). A link from a notification tells the beta's report where the visit came from.

- Reminders by Web Push (M10b): after sending a pack in a 24-hour game, "remind me when my pack is due" asks for permission and subscribes the browser; the server wakes it with a payloadless push signed with the deployment's VAPID key (ES256), to browsers' own push services only, and forgets a subscription its push service says is gone. The service worker fetches your games and shows the one waiting; tapping it opens the game. `mix gitgame.vapid_keys` makes the key pair.

- Reminders by email, and the daily digest (M10c): a player gives an address on the start screen, confirms it from the link emailed to it, and then hears "your pack is due" by email, or chooses one digest a day listing the games waiting on them. Every email after the confirmation carries a one-click unsubscribe (RFC 8058). Sent over SMTP, so the provider is configuration; in development, written to the log. M10 is done.

- Ready for Fly.io (M11b/c, ADR-0007): `fly.toml` runs one machine that never sleeps (every open game holds a live stream), with health checks and migrations before each deploy, and a workflow deploys a `v*` tag, never a branch. Behind Fly's proxy the server reads the caller's address from `fly-client-ip`, so the rate limits count people. Deploying needs the maintainer's Fly account; the steps are in `server/README.md`.

- ADR-0008: the beta's database is its own database, with its own non-superuser, on an existing Postgres (`rps-db`) rather than Fly's managed Postgres, for cost; the app is `gitgame-online`, in `lax`, served at gitgame-online.fly.dev until gitgame.online's DNS points at it.

### Changed
- A guided first game (M14d): a player's first game against the bot shows one sentence and highlights one thing at a time through the first day (pick a card, `git add`, `commit`, push and the pull written before it, send), explains what face-down commits mean on the second, and lets go. It can be skipped at any step.
- Moments move (M14c): a push's commits fly onto `main`, a rejected push is knocked back from the tip, a pull slides the pointer along what came in, a conflict's two commits meet over their file, blame flips the commit, a force-push drops what it erased and lands what it pushed, and a reflog raises what was erased; none of it under `prefers-reduced-motion`. A commit the reader can't see is drawn face-down.
- The bot explains itself, one step at a time (M14b): it writes a public reason for each op it plays ("main has moved: it pulls before it pushes"), from what anyone at the table could see and never from its hand; the reason travels with the op into the day log, and the client shows each of the bot's ops as its own screen, with the reason in a bubble, moving on by itself after a moment. Staging folds into the commit it makes.
- The hub and scoreboard, closer to the prototype (M14a): you're pink and others a neutral grey, colors no card uses; the hand fans, in one row or two, each card keeping a finger's width to tap; each action says what it would do in your situation; the BUG tag sits where an overlapping card can't hide it; the scoreboard says what decided the game.
- Rules v0.2. ADR-0003: a day's packs resolve together at the deadline, in a seeded random order, instead of on arrival. A plain pull takes a merge token only when it merges unpushed commits. Hand limit of 10. The deck has 5 `push --force` and 4 `reflog` cards (was 3 and 3), 33 command cards in all. The online rules are data in `rules/online.json`; `round-resolution.md` is spec v0.2 with its five ambiguities settled; the print-and-play PDF is rebuilt.

### Fixed
- Hand cards lost their padding to the fanned hand's container, and the BUG tag sat on the card's number; both are back where they belong.
- The signed cookie that holds a GitHub link in progress (its `state` and PKCE verifier) is now `Secure` wherever there is TLS, as the session cookie already was.
- Writes from the game's own page were refused wherever the address people use differs from the server's configured one (behind a proxy, or on another port): the origin check now compares the page's host with the host the request was sent to.
- A force-push answered by a reflog printed the restored commit as its new tip (`+ b0ba026...b0ba026`). The forced-update line now shows what the force-push itself made the tip, as Git does; the reflog is its own event.

[Unreleased]: https://github.com/modirniya/gitgame/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/modirniya/gitgame/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/modirniya/gitgame/compare/v0.1.4...v0.2.0
[0.1.4]: https://github.com/modirniya/gitgame/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/modirniya/gitgame/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/modirniya/gitgame/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/modirniya/gitgame/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/modirniya/gitgame/releases/tag/v0.1.0
