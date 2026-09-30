# Phase 1 and the beta: build plan

*Status: Draft · Last verified: 2026-09-29 · Deleted when the beta ships; its decisions live in ADRs and the specs*

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
- [ ] `GitGame.Bot` writes a day's pack from the viewer's own projection, never the full state. It writes a defensive pull before every push and force-pushes over a single big commit when it holds the card (the packs prototype's v0.2 finding), so solo players meet the reflog moment.
- [ ] A game can be created with bots in any seat.

*Done when:* a bot-vs-bot game plays to the release through the API alone, and a human-vs-bot game can be played by a script calling the API.

### M7 · Hotseat web client
- [ ] `web/`: Vite and a PWA, no framework unless an ADR adds one. The terminal-style UI the charter asks for, on the screen spec in [event-screens.md](event-screens.md): the event-to-screen mapper, the hub, and the Table as a sheet on phones and a panel on wide screens.
- [ ] A pack editor that writes `pull` before `push` by default and shows each op's cost as the remote will charge it.
- [ ] The live view through a push channel that only signals "refetch" (charter decision 9).
- [ ] A replay view: any finished game, day by day, from its log.

*Done when (Phase 1 exit):* a full game against the bot is played in the browser, and replayed from its log.

## Phase 2: the beta

Rough until Phase 1 is done; each needs its details written before it starts.

- **M8 · Identity:** GitHub OAuth, with anonymous play as the fallback and a nudge to link (charter decision 15). This needs the RPS auth code the charter lifts, or an ADR to write it fresh.
- **M9 · Rooms:** private rooms by link, invites, and quick "play the bot now" (charter priority 2: a game in five seconds).
- **M10 · Notifications:** push, email and the daily digest; "your pack is due" is the retention loop (charter decision 16).
- **M11 · Hosting:** an ADR choosing the host (none is chosen yet), then deploy from tags, never branches ([workflow.md](../workflow.md)).
- **M12 · Beta telemetry:** what ADR-0002 promises the beta records: how rejections, conflicts and absences go, completed games, and players who come back unprompted. Nothing keeps score across games before rules v1.0.
- **M13 · Beta launch:** strangers finish games; the Phase 0 exit (two people ask to play again unprompted) is checked here.

## Open items

- [x] **Merging:** branch protection needs a review the maintainer can't give on their own PRs. Decided 2026-09-29: PRs are squash-merged with `--admin` once CI passes, and the maintainer is told what merged.
- [ ] **RPS and PlayLounge:** the charter lifts auth, the FCM notifier and the client skeleton from them. Where they are is needed by M8.
- [ ] **Hosting:** chosen by ADR before M11.
- [ ] **Playtest question 3** (bot-authored packs for absent players): the beta's to answer; M5 makes empty packs the default.
