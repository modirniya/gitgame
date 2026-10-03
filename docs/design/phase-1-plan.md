# Phase 1 and the beta: build plan

*Status: Draft · Last verified: 2026-10-01 · Deleted when the beta ships; its decisions live in ADRs and the specs*

The plan from rules v0.2 to a beta that strangers can finish games in. The [charter](../adr/0000-project-charter.md) sets the phases. [ADR-0002](../adr/0002-beta-before-human-playtest.md) makes the beta the playtest, and [ADR-0003](../adr/0003-batch-packs-at-the-deadline.md) sets how a day resolves. Each milestone below is several pull requests; a session starting work reads the charter, [conventions.md](../conventions.md), [workflow.md](../workflow.md) and this plan, and picks up at the first unchecked box.

## Ground rules

- **This is product code, not a prototype.** The full conventions apply: `mix format` and Prettier enforced in CI, about 400 changed lines per PR, one concern per PR, tests beside the code, `why` comments only, the fixed vocabulary (day, pack, op, remote, tip, pointer, trap; never turn, round or move in server code).
- **Nothing is copied from `prototypes/`** ([ADR-0001](../adr/0001-prototypes-are-disposable.md)). Their findings are in the specs; the code is written again against the specs.
- **Rules are data.** Every number and switch comes from [`rules/deck.json`](../../rules/deck.json) and [`rules/online.json`](../../rules/online.json). A game stores the rules version it was created with, so changing the rules never changes a game in progress.
- **The resolver is pure.** State in, events out, no side effects, no clock, no randomness except from the game's seed. Everything else is plumbing around it.
- **Git-accurate or not at all.** Errors and output are Git's own words; when unsure, run Git.
- **Each milestone ends green:** CI passes, and the milestone's "done when" is shown by a test, not asserted in a PR description.

## Phase 1: the engine

The charter's exit: *a full game can be played and replayed from its log.*

### M1 · Server skeleton
- [x] `server/`: a Phoenix app with no HTML, assets, mailer or dashboard: `--app gitgame --module GitGame`, per [branding.md](../branding.md). Postgres through Ecto.
- [x] `GitGame.Brand` is the one place the name is defined, marked `# BRAND`.
- [x] CI: a second job with Elixir and a Postgres service. It runs `mix format --check-formatted`, `mix compile --warnings-as-errors` and `mix test`. Branch protection gets the new check.
- [x] A health endpoint and one test that hits it.

*Done when:* CI is green on the empty app, and `mix phx.server` answers the health check locally.

### M2 · Rules

**Scope (decided 2026-09-29): the tested core first.** M2 builds only what the prototypes and simulations exercised: add, commit, push, pull, rebase, conflicts, `blame`, `revert`, `push --force`, `reflog`, and the Flaky CI, Standup Ran Long, Stack Overflow Is Down and Hackathon incidents, plus two quiet days, as simulated. `rules/online.json` switches these on; the other six commands and four incidents stay in the tabletop deck and come online one small PR at a time, each with its online rules made precise first.

- [x] `GitGame.Rules` loads `rules/deck.json` and `rules/online.json` into a validated struct, failing loudly on a missing or unknown key, and exposes nothing the JSON doesn't say.
- [x] `GitGame.Game`: the state of one game (`main`, pointers, hands, staged cards, local branches, tokens, armed traps, the deck, the day, the incident), built from `new(rules, seed, players)`.
- [x] One module per op family (commit ops, remote ops, command cards, traps), for the cards `rules/online.json` switches on, each a pure function of state and op → state and events, using Git's messages.
- [x] Scoring and the release (CI, production down, least blame), with the live score counting a face-down bug as clean.

*Done when:* every op in round-resolution §3 has unit tests for success, each failure, and cost, including the v0.2 rules: free pull and push when there is nothing to do, a merge token only when merging unpushed commits, `--resolve` at +1, failed command cards staying in hand, and one reflog restoring everything. (The hand limit happens at the end of a day, so it is in M3.)

### M3 · Resolver
- [x] `GitGame.Resolver.close_day(game, packs)`: runs each pack to its budget, in the order `rules/online.json` names (`batch_at_close`, a seeded shuffle, by default; `arrival` as the alternative), and returns the new state and the ordered events: the day log.
- [x] Day start and end (`open_day/1`): the incident, draws, the hand limit, the final day's CI. Every card that leaves play goes to a discard pile, so cards are conserved.
- [x] Property tests (StreamData), which the charter makes non-negotiable before Phase 2:
  - any sequence of valid packs from any reachable state gives a valid state (pointers in range, cards conserved, budgets respected);
  - replaying a game's events from its seed reproduces its state exactly;
  - both resolution orders satisfy both properties.

- [x] Absence, which is pure rules and so lives in the resolver: no pack is an empty pack, and two in a row is leaving the company (no more packs or draws; commits stay and take blame).

*Done when:* the property tests pass under both orders at a few thousand generated games each, and a replay of any generated game is byte-identical.

### M4 · The event log
- [x] Tables: `games` (seed, seats, day length, and a snapshot of the rules it was created with) and `game_events`, the append-only log of inputs (`game_created`, `pack_sent`, `day_closed`; a later pack replaces an earlier one), enforced append-only by a trigger ([ADR-0004](../adr/0004-the-event-log-stores-inputs.md)). No table holds derived state; it is folded from the log.
- [x] Every write carries the game version it was written against, and a stale write is rejected in Git's words (`! [rejected] ... (fetch first)`), after which the client refetches. A game's version is its latest `game_created` or `day_closed`, so other players' packs never make yours stale.
- [x] A small JSON API: `POST /api/games`, `GET /api/games/:id` (the public view: what everyone at the table may see), `POST /api/games/:id/packs`. Until M8 there is no sign-in, so a pack names its player: fine for the hotseat client.

*Done when:* a game survives a server restart mid-day with nothing lost, and a stale pack is rejected with the fetch-first message.

### M5 · Days on a clock
- [x] Oban jobs close each day at its deadline, or as soon as every pack is in. Closing a day is idempotent, so a retried job can't resolve a day twice. Each day's job is enqueued in the same transaction that opens the day.
- [x] Absence: done in M3, since it is pure rules; M5 only has to close days on time.
- [x] Day lengths 24h, 5m and 60s, with the same code and a different number (from `rules/online.json`).

*Done when:* a scripted 60s game runs to its release unattended, with one player going absent, and the same game at 24h does too under a fake clock.

### M6 · Views and bots
- [x] A per-viewer projection of state and events (`GitGame.Games.Projection`, `View.for_player/3`, `GET /api/games/:id?player=`). Another player's hand, staged cards, hidden bugs and armed traps appear only as counts; a property test checks that no view ever contains another player's private data.
- [x] `GitGame.Bot` writes a day's pack from the viewer's own projection, never the full state, as JSON through the same door as anyone's. It writes a defensive pull before every push and force-pushes over a single big commit when it holds the card (the packs prototype's v0.2 finding), so solo players meet the reflog moment.
- [x] A game can be created with bots in any seat (`bots` on `POST /api/games`). A bot sends its pack the moment each day opens; with batching (ADR-0003) that costs it nothing.

*Done when:* a bot-vs-bot game plays to the release through the API alone, and a human-vs-bot game can be played by a script calling the API.

### M7 · Hotseat web client
- [x] `web/`: Vite and a PWA, no framework unless an ADR adds one. The terminal-style UI the charter asks for, on the screen spec in [event-screens.md](event-screens.md): the event-to-screen mapper, the hub, and the Table as a sheet on phones and a panel on wide screens.
- [x] A pack editor that writes `pull` before `push` by default and shows each op's cost as the remote will charge it: now, and at most if another pack lands first (ADR-0003's random order).
- [x] The live view through a push channel that only signals "refetch" (charter decision 9): Server-Sent Events, since a browser's `EventSource` reconnects by itself and a reconnect is one more refetch.
- [x] A replay view: any finished game, day by day, from its log (`#/r/<id>`, each day folded by the remote from the log up to its close).

*Done when (Phase 1 exit):* a full game against the bot is played in the browser, and replayed from its log.

*Met 2026-09-29.* CI's exit job plays a whole game against the bot through the client's own modules on a real server, then replays it day by day and checks each day against the game as it ended. By hand: a seven-day correspondence game against the bot, played in the browser at the mobile preset (ana 36, bot 28, no bugs reached production), then replayed.

## Phase 2: the beta

Rough until Phase 1 is done; each needs its details written before it starts.

### M8 · Identity

GitHub OAuth, with anonymous play as the fallback and a nudge to link (charter decision 15), written fresh per [ADR-0005](../adr/0005-sign-in-written-fresh.md).

- [x] **M8a · Players and sessions.**
  - Tables `players` (a unique handle, and the GitHub id, login and avatar once linked) and `sessions` (the SHA-256 of a random token, its player, when it expires).
  - `POST /api/players` makes an anonymous player with a generated handle and signs the device in. `GET /api/session` says who you are; `DELETE /api/session` signs out.
  - The session is a `gitgame_session` cookie: `HttpOnly`, `SameSite=Lax`, and `Secure` outside development. Writes from another `Origin` are refused.
- [x] **M8b · Seats belong to players.**
  - A `game_seats` table maps each seat to a player or a bot, and a game is created by a signed-in player, who takes the first seat. Hotseat games name the other people at the device, whose seats the creator also holds.
  - The API stops trusting `?player=`. You see a game as the seat you hold, or choose among the seats you hold in a hotseat game, and packs are written only for a seat you hold.
  - The client signs in anonymously on first open, and the exit test plays with a session.
  - Games created before M8 have no creator to give their seats to, so they stay readable and take no more packs. Only development databases have them.
- [x] **M8c · Link GitHub.**
  - `GET /api/auth/github` and its callback, through Assent's generic OAuth2 strategy: `state` and PKCE, no scopes, GitHub's token discarded.
  - A new GitHub account attaches to the current player. A known one signs the device in as its player, and moves the anonymous player's seats over where that doesn't seat one player twice in a game.
  - Tested against a stand-in for GitHub, never the real one.
- [x] **M8d · Who you are, in the client.** Your handle and avatar, "link GitHub" in the menu and as a nudge after your first finished game, and sign out.

*Done when:* a new visitor starts a game against the bot without signing in. They link GitHub after it ends, open the game from a second browser signed in with the same GitHub account, and find it there. And nobody can read or write a seat that isn't theirs, which a test checks through the API.

*Met in tests 2026-09-30,* against a stand-in for GitHub: the exit test starts as a new visitor with no form; `AuthControllerTest` links a first device, then signs a second in as the same player and finds its game there; `GameControllerTest` checks that no one reads or writes a seat that isn't theirs. The same trip against real GitHub waits for an OAuth app's credentials (`server/README.md`).

### M9 · Rooms

Private rooms by link, and a game against the bot in one tap (charter priority 2: a game in five seconds). A room is where a game is gathered before it starts: a game's seats are fixed when it is created, since the log names them (ADR-0004), so people join the room, not the game.

- [x] **M9a · Rooms on the server.**
  - Tables `rooms` (a short code, its host, the day length and number of bots, and the game once started) and `room_members` (who joined, in order).
  - `POST /api/rooms` opens a room with you as its host. `GET /api/rooms/:code` shows it, `POST .../join` joins it, `PATCH` lets the host change the bots and day length, and `POST .../start` lets the host start the game: every member takes a seat under their handle, in the order they joined, then the bots.
  - A room is full at five seats, members and bots together, and is closed once started. `GET /api/rooms/:code/live` says `refetch` whenever it changes, and ends when the game starts.
- [x] **M9b · Rooms in the client.** The start screen's first button plays the bot now, in one tap; the second opens a room and shows its link to share. The room screen lists who is in, lets the host set bots and start, and takes everyone to the game when it starts. The hotseat form stays, under "more".
- [x] **M9c · Your games.** `GET /api/games` lists the games you hold a seat in, and whether your pack is in for today; the start screen lists them, those waiting on you first.

*Done when:* one browser opens a room, a second opens its link and joins, the host starts, and both play the same game from their own seats, which a test does through the API; and a first visit reaches a game against the bot in one tap.

*Met 2026-09-30.* `RoomControllerTest` plays a room from open to a closed day with two devices. By hand: a room opened in the browser, a second device joined by its code, and the host's screen showed them at once; the host started and both held their own seats; and "play the bot now" went from the start screen to a game in one tap.

### M12 · Beta telemetry

What [ADR-0002](../adr/0002-beta-before-human-playtest.md) promises the beta records, "without the player doing anything": when each pack was sent against how it went (playtest question 1), failed pushes and what followed them (question 2), absences (question 3), and completed games and replays (the exit). Most of it is already in every game's log (ADR-0004), so M12 adds only what the log can't know, and a report that reads both. Nothing keeps score across games before rules v1.0, and nothing here is shown to players.

Taken ahead of M10 and M11, which each need a decision first (a notification provider, a host); M12 needs none.

- [x] **M12a · Marks.** A `beta_marks` table for what the log can't know: a player's visit (at most one a day, with where it came from once notifications exist, so "came back unprompted" can be told apart), and a replay opened. Recorded by the server as it answers; nothing is sent from the client for it.
- [x] **M12b · The report.** `mix gitgame.beta_report` prints, from the logs and the marks: games started and finished (the charter's "≥ 50% of started games reach a release"), how late in the day packs were sent against how they went, failed pushes and the next op of whoever failed, absences and who left, replays per finished game, and players who came back on another day or started another game after finishing one, unprompted.

- [x] **M12c · Rate limits.** The abuse control [ADR-0005](../adr/0005-sign-in-written-fresh.md) asks for before strangers arrive: new players per address, and games and rooms per player, each capped per hour (`config :gitgame, :rate_limits`), answered with `429` and `retry-after`. Behind a proxy, M11 must pass on who asked.

*Done when:* the report runs on a database of generated games and its numbers match what a test computed from the same games.

*Met 2026-09-30* by `GitGame.Beta.ReportTest`. It found one thing worth reporting apart: a game whose people have all left plays itself to its release with the bots, so the report counts games *finished by people* (someone still in the company) separately from games that reached a release, and the charter's share is of the first.

### M10 · Notifications

"Your pack is due" is the retention loop (charter decision 16), sent as [ADR-0006](../adr/0006-notifications-web-push-and-email.md) decides: standard Web Push and email, written fresh, only in games with 24-hour days, at most once per game a day on each channel.

- [x] **M10a · Reminders.** A `notifications` table records what was sent to whom, for which game and day, on which channel; its unique index is what keeps "at most once". When a 24-hour day opens, and again when a quarter of it is left, an Oban job finds the people whose pack isn't in and hands each a reminder for every channel they have. When a game is released, everyone in it gets "v1.0 has shipped". A link from a notification says where it came from (`?via=`), and the beta counts that visit apart (M12). ADR-0006's cap wins over its second reminder: the job with a quarter of the day left reaches only someone the first couldn't, such as a player who subscribed in between.
- [x] **M10b · Web Push.** VAPID keys from the environment; `push_subscriptions` stored when the service worker subscribes; a payloadless push, signed with the VAPID key, to each subscription, which is dropped when its push service says it is gone. The service worker, woken, fetches your games and shows the one waiting; tapping it opens the game. The client asks for permission only after a pack has been sent in a 24-hour game, from a "remind me" button.
- [x] **M10c · Email.** An address given for reminders, confirmed by a link before anything is sent, with a one-click unsubscribe in every email; sent over SMTP through Swoosh (the provider is configuration). The daily digest is one email a day listing the games waiting on you, for players who choose it instead.

*Done when:* in tests, a 24-hour game's day opening sends one push to a stored subscription (a stand-in push service) and one email to a confirmed address (Swoosh's test adapter) for a player whose pack isn't in, none to one whose pack is, and none twice; and opening the game from it marks a visit that came from a notification.

*Met 2026-09-30* by `NotificationsDoneTest`. By hand in development: an address given in the browser, its confirmation email read from the log, its link followed back to the client. Not yet checked for real: a push reaching a real browser (this project's embedded browser runs no service workers) and an email through a real SMTP provider; both need the deployment's keys and the host (M11b).

### M11 · Hosting

Where the beta runs, and how a version gets there: deployed from tags, never branches ([workflow.md](../workflow.md)). The host is a decision with lasting cost, so it is an ADR, and the maintainer's to accept; everything that doesn't depend on it comes first.

- [x] **M11a · One image, one origin.** The server serves the built client from its own origin, which the session cookie needs ([ADR-0005](../adr/0005-sign-in-written-fresh.md)): `/` is the client's page, with a Content Security Policy, and its files sit beside it. A `Dockerfile` at the root builds the client, the release and the rules into one image that migrates its database before it serves; CI builds that image, runs it against Postgres, and plays the exit test on it.
- [x] **M11b · The host.** Fly.io, per [ADR-0007](../adr/0007-where-the-beta-runs.md): one machine running the image, Fly's managed Postgres, TLS for gitgame.online. The server reads the caller's address from Fly's proxy, so the rate limits count people, not the proxy. The maintainer creates the app and its database, sets the secrets, and points the domain at it (`server/README.md`, "Deploying"). Ready for that: `fly.toml` (one machine that never sleeps, health checks, migrations as the release command), and the caller's address read from `fly-client-ip`. **Live 2026-09-30 at https://gitgame-online.fly.dev**, with its database on `rps-db` ([ADR-0008](../adr/0008-the-beta-shares-a-postgres.md)); the exit test passed against it, and the service worker registers there. gitgame.online points at it, with its certificate issued (2026-09-30).
- [x] **M11c · Deploy from tags.** A workflow that builds the image for a `v*` tag and deploys it to the host, migrating first; `main` never deploys by itself (`.github/workflows/deploy.yml`). **The v0.1.0 tag deployed through it on 2026-09-30:** migrations ran, `https://gitgame.online/api/health` answered 200, and the page served the new client.

*Done when:* a tag puts a version on gitgame.online, where a stranger can play the bot in one tap.

*Met 2026-09-30* by the v0.1.0 tag: its deploy workflow put the version on gitgame.online, where "play the bot now" starts a game in one tap.

### M14 · What the prototype had, online (before v0.1.0)

The maintainer, playing the beta, found it poorer than the mobile prototype. The online rules account for some of the difference (no turns: a day's packs resolve together, ADR-0003; strategies declared on the pull, charter decision 3). The rest was lost in the rewrite, and comes back here, within the online model, before the first release (decided 2026-09-30).

- [x] **M14a · Colors, the hub, the scoreboard.** Player colors outside the deck's file colors (the prototype's finding 5); the hand fanned, in one row or two, every card keeping a finger's width; each action saying what it would do in your situation, not only why it can't; the scoreboard's "what decided it".
- [x] **M14b · The bot's reasoning.** The bot writes a public "why" for each op it plays, from what anyone at the table could see, and the day's screens show it beside the bot's commands.
- [x] **M14c · Animations.** The motions of event-screens §4 on the moment screens: a push flying onto `main`, a rejection bouncing back, a pull sliding the pointer, a force-push dropping commits and a reflog raising them; none under `prefers-reduced-motion`.
- [x] **M14d · The guided first game.** A first game against the bot that highlights one thing and says one sentence at each step, through a whole day: build a commit, push (and the pull written for you), send, and see what the day did.

### M15 · The prototype's feel, online

The maintainer, having played both, still finds the live game short of the mobile prototype after M14. A session played both the same way at 390 × 844 and 1280 × 800, guided and unguided, as fresh players, and published the comparison, screen by screen, with every gap classified. The gap: the prototype answers every op the moment you take it, on a table you can see; the live game has you write a pack as a form, then plays the day back as terminal screens, most of them the bot's routine, and after the first day never shows what became of your own push. The online rules explain why the answer comes later (ADR-0003); they don't explain the rest. M15 closes it within the rules: presentation, pacing and response, not the resolver. Steps, most important first; each is a PR or a short stack.

- [x] **M15a · Git's words, and all of them.** Lines of output wrap on a phone instead of hiding behind a sideways scroll. A pull settled by a declared strategy prints what Git prints (`Auto-merging`, then the merge or the rebase, and CONFLICT only for `--resolve`, which is resolved by hand), and a merge says so even when `-X theirs` took your commit. The game's own notes (what a force-push erased, what a strategy dropped or crossed out, a merge token) are `#` comments, never lines Git would print; a failed command shows its target. A commit is written with a real message for the files staged, offered as suggestions, never `-m ""`. A pack holds one `git tag`. The bot no longer blames a commit its own force-push erases in the same pack. *Done 2026-10-01* (#84 the client, #86 the server; verified against Git 2.50 in a scratch repository).
- [x] **M15b · The frame.** A status bar on every game screen, as the prototype has: the day, `main` against the release size, the ops as pips, the live score, and the Table one tap away (a sheet on phones, the panel on wide screens). The day's opener deals the incident and your draws and says where you stand: at the tip, or behind and what that costs. *Done 2026-10-01* (#88). Found on the way: a long score could widen the game's grid column past a phone's width, and the phone then zoomed the whole page out; the column is now `minmax(0, 1fr)`.
- [x] **M15c · The look.** The prototype's visual language on the online client: prose in a sans-serif, commands and Git's output in monospace; cards with their band and label (commit, command, incident), the BUG tag where overlap can't hide it, face-down commits as a hatch with their hash; `main` with each slot labelled (author, file, lines), its tip marked and the pointers as chips; big actions with their cost and what they'd do. The landing page and its preview image follow. *Done 2026-10-01* (#87).
- [x] **M15d · The hub is a table.** Your branch, with where you stand, and its two zones (staged, to push) drawn as the pack would leave them; four big actions (add, commit, push, pull) at the thumb, the action of a command card once you pick one, and the tag when it can be played; the pack as a short receipt you can undo from the end; send always in reach. The pull's conflict strategy is chosen by what it does (keep theirs, keep mine, keep both), and the command shows Git's flag for it, which swaps under `--rebase`. *Done 2026-10-01* (#90).
- [x] **M15e · Each op answered as you write it.** Adding an op moves the cards it moves, on the hub: the card into staging, staging into a commit, the commit to a ghost at the end of `main` with your pointer at the tip, and the pips fill. A one-line receipt says what the op will do, and what could still change that once the day resolves. *Done 2026-10-01* (#91).
- [x] **M15f · The day plays back.** Each closed day in the view carries `main`, the pointers and the scores as the day opened, so the client can draw the table at every step of the day. The playback shows each step on that table with its motion; the order the remote drew for the packs; every remote op of yours, a push that landed, was rejected or didn't fit the budget; and ends on the day's receipt: your ops and how each went, the score it changed, and where you now stand. *Done 2026-10-01* (#83 the server, #93 the client). The fold is checked against a whole game the server played: every day ends on exactly the table the next day opened on.
- [x] **M15g · The bot is a character.** An avatar and a speech bubble; its local ops fold into one step ("built a commit"), and a pull that changes nothing folds into what follows; one step per remote op with its ops counted; a reason that says what it meant and how it went, so it never claims to ship what turned out up to date; auto-advance with a visible bar, and "skip" that still stops on what you must not miss. *Done 2026-10-01* (#94).
- [x] **M15h · The guided first game, again.** The server chooses a guided game's seed so that day 1 is a full day, a clean card is in hand, and your pack resolves first, so the first push lands, as the prototype's did. The guide counts its steps, sits where it covers nothing you need, speaks during the day's playback, explains day 2 from what day 1 did, and teaches the pull when you are behind. *Done 2026-10-01* (#85 the seed, #95 the guide). About one seed in three fits, so a search takes a few tries and guided games still differ from one another.
- [x] **M15i · The release.** CI flips the real commits on `main` one by one, the bugs turning red, and tallies them; the scoreboard reads across: a headline, who won, each part of the score by player, and what decided it. *Done 2026-10-01* (#92). Production down now names the winner as the server does: the least blame.
- [x] **M15j · Wide screens.** The hand stays inside the hub beside the Table panel; the panel keeps a log of the days; every screen above is checked at 1280 × 800. *Done 2026-10-01* (#88 the layout, #97 the log).
- [x] **M15k · A hint.** What a good player would do now, from the bot's own policy run on your view (nothing a player couldn't see), shown on the hub when asked for. *Done 2026-10-01* (#89 the server, #96 the client).

*Done when:* a side-by-side play-through at 390 × 844, the prototype's guided game against the online guided game and then an unguided game of each, shows every op you write answered on the hub as you write it, and every day's close showing what became of your pack and where you stand, with the screenshots in the analysis; and tests show it:
- the hub's table after each op is the pack's own model of it (`pack.js` `price`), for every action;
- a day's playback draws `main` at each step as the resolver left it (checked against games the server played);
- the bot's routine is at most one step a day, and its bubble agrees with what its op did;
- a guided game's first push lands on day 1, over many seeds;
- every pull settled by a strategy prints Git's own output, checked against a transcript of real Git.

Decided by the session, for the maintainer's review:
- **The guided game's first push lands because of the seed, not a head start.** The prototype gave the bot a commit ready to push; that is a rules change online. Choosing the seed (a full day 1, a clean card, your pack first that day, and that pack's push landing even under Flaky CI) teaches the same lesson with the rules untouched. About one seed in three fits, so guided games still differ.
- **Player colors stay as M14a chose** (you in pink, everyone else in grey-blue, both outside the deck's file colors). The prototype's violet bot collided with `api.py`; the bot becomes a character through its avatar and bubble instead.
- **During a day's playback the frame shows the score as the day opened**, and the day's receipt shows the change. Scores aren't recomputed step by step in the client, which would mean writing the scoring rules twice.
- **The bot's local ops fold into one step**, as the prototype's findings recommended; its remote ops keep one step each.
- **Prose in a sans-serif.** Charter decision 14 asks for a terminal-style UI; the terminal stays where Git speaks (commands, output, the transcript), and the sentences around it read as the prototype's did.
- **Strategies are chosen by what they do, and printed as Git's flags.** The pack format keeps the game's meaning (`theirs`: their commit wins); under `--rebase` the command shows `-X ours` for it, because that is what Git calls keeping the upstream side while rebasing. No rule changes.
- **Hands are not revealed at the scoreboard** (the prototype revealed both). Showing a person's hand after the game is a privacy choice, not presentation; it is left for the maintainer.

Needs a rules change, so written as a Proposed ADR and not built: **`-X theirs` drops your whole commit**, where Git loses only your side of the files that clashed.

### M13 · Beta launch

Strangers play the beta, and it answers what the playtest would have ([ADR-0002](../adr/0002-beta-before-human-playtest.md)). The milestone is read through M12's report: every number below is one `mix gitgame.beta_report` prints. What is the maintainer's to decide is marked **open**. M13a needs no decision; the rest wait on the ones they name.

- [x] **M13a · The report reads production, and only the beta.**
  - The release has no Mix, so the report gets a command of its own in the image, `bin/beta_report`. It prints what `mix gitgame.beta_report` prints, read where the data is (`fly ssh console -a gitgame-online -C /app/bin/beta_report`). CI runs it inside the release image, after the exit game.
  - It counts from a date (`--since`), so games played while the beta was built and tested don't count as strangers'. Those include the maintainer's own and the ones sessions played to check the deployment. `ReportTest` checks what it leaves out.
  - *Decided 2026-10-01:* the beta counts from **2026-10-01** (`--since 2026-10-01`), which leaves out every game played while it was built and tested. **Open:** whether the team's own games after that are left out too, and how.
- [ ] **M13b · Ready for strangers.** Done once, before anyone is invited:
  - **The optional features.** Each one launched is tried once on the deployment (`server/README.md`, "Turning on the optional features"), which closes the open item "Checks only a deployment can make". **Open:** which of GitHub sign-in, email and push are on at launch. Anonymous play needs none of them.
  - **A restore.** `rps-db`'s snapshot is restored once into a scratch app, so a restore has been done before one is needed ([ADR-0008](../adr/0008-the-beta-shares-a-postgres.md)). The maintainer's to do: it creates an app.
  - **Feedback.** Somewhere for players to say what broke or what they think. *Decided 2026-09-30:* a box on every game's scoreboard, up to 1000 characters, one note per player and game that they can rewrite; read with `bin/beta_report --feedback`. Built.
  - **Capacity.** One `shared-cpu-1x` machine with 512 MB, with live streams capped at 2,000 connections (`fly.toml`). New players are capped at 60 an hour from one address (`config :gitgame, :rate_limits`), which an office or a conference behind one address could reach. **Open:** whether that is enough for the invitations below; more costs money.
- [ ] **M13c · Invite.** *Decided 2026-10-01:*
  - a public launch now, on Hacker News and r/git, with no private wave first, aiming at 5–10 people to begin with;
  - the README badge waits for later.

  The maintainer posts; the repository's README says where to play first. Ticked once the posts are up.
- [ ] **M13d · Read it.** Every week while the beta runs, the report's output is recorded, dated, in [round-resolution.md](round-resolution.md) §7, beside the simulations' provisional answers to the playtest questions:
  1. **When packs are sent** against how their pushes went: whether batching at the deadline ([ADR-0003](../adr/0003-batch-packs-at-the-deadline.md)) stays, or arrival order (one setting) is tried.
  2. **What people do after a failed push:** whether paying for a rejected push stays.
  3. **Absences and who left the company:** whether an absent player's pack is written by a bot instead of left empty.

  **Open:** how many finished games are enough to decide each. Each decision is a rules change, and gets an ADR where it changes a locked line.
- [ ] **M13e · A pulse.** A private page at `/stats` shows at a glance that the game is being played, between the weekly reports. It is a pulse, not a measurement: the team's own and test players count like anyone else's, and the numbers that decide anything stay the report's (M13a, M13d).
  - **What it shows, on one screen.**
    - A pulse line: when a person last sent a pack, when the last game was started, and how many games are in progress.
    - Totals: players, games, and packs sent by people.
    - Bars for new players, games started, packs sent by people, and visits, per day (the last 30), per week (the last 12) or per month.
    - Bots' packs are left out, since they only echo the people's.
  - **How.**
    - `GitGame.Stats` counts by day, over the last year, from the tables there already are: `players`, `games`, `game_events` and `beta_marks`. Days with nothing come back as zeros.
    - `GET /api/stats` returns the counts as JSON, and the page adds days up into weeks and months.
    - The page is a third entry in the web client (`stats/index.html`), with plain SVG bars and no chart library, kept out of search results as `/play` is.
    - Nothing new is recorded: no tracking, no cookies, no table or migration, no other app, and nothing in `rps-db` beyond the `gitgame` database. No ADR, since no rule or locked decision changes.
  - **Locked by a token.** One plug guards both `/stats` and `/api/stats` with HTTP Basic auth, the token as its password (any user name), so a browser asks once and remembers it for the page's own requests. The token is `STATS_TOKEN`, a Fly secret; until it is set, both paths answer 404, so nothing is exposed by default. It may start as a plain shared secret and become a real token later; the name already allows for that.
  - **Tests:** the lock refuses without the token, and the counts add up over a few seeded rows.
  - The maintainer's to do: `fly secrets set STATS_TOKEN=… -a gitgame-online`. Setting a secret restarts the app.

  *Built 2026-10-02, in v0.3.3; ticked once `STATS_TOKEN` is set and the page is checked on the deployment.* *Decided 2026-10-02:* the page is for the maintainer only, and test players aren't filtered out. Where visitors come from would mean recording something new, so it is a separate question and not part of this. *Done when:* with `STATS_TOKEN` set, `/stats` on the deployment shows the pulse, the totals and the four charts in each period, and without the token both paths refuse.

*Done when:* the report, run on production over the beta (M13a), shows two things.

- **The charter's Phase 2 exit.** Strangers have completed games, and at least half of the games people started reached a release with someone still in the company ("finished by people", the charter's "≥ 50% of started games reach a release"), over at least *N* started games. **Open:** *N*.
- **The Phase 0 exit, which ADR-0002 moves to the beta.** At least two people ask to play again, unprompted. The report's nearest numbers are the players who came back on another day with no notification, and those who started a game after finishing one. **Open:** whether those count as asking, or only people who say so. The other half of that exit, the rules reaching v1.0, follows from M13d's decisions.

## Open items

- [x] **Merging:** branch protection needs a review the maintainer can't give on their own PRs. Decided 2026-09-29: PRs are squash-merged with `--admin` once CI passes, and the maintainer is told what merged.
- [x] **RPS and PlayLounge:** no longer needed. Sign-in ([ADR-0005](../adr/0005-sign-in-written-fresh.md)) and notifications ([ADR-0006](../adr/0006-notifications-web-push-and-email.md)) were written fresh, and the client (M7) was written against the specs.
- [x] **Hosting:** Fly.io, [ADR-0007](../adr/0007-where-the-beta-runs.md) (2026-09-30).
- [ ] **Checks only a deployment can make:** a real push to a real browser, an email through the real SMTP provider (none is set up yet), and linking a real GitHub account (no OAuth app yet). Each is built and tested against a stand-in; each gets tried once on the deployment. The service worker registers there (checked 2026-09-30); its local failure was plain HTTP.
- [ ] **Playtest question 3** (bot-authored packs for absent players): the beta's to answer; M5 makes empty packs the default.
