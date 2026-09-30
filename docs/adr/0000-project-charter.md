# ADR-0000: Project charter

*Status: Accepted; §5 Phase 0 amended by [ADR-0002](0002-beta-before-human-playtest.md); decision 11 superseded by [ADR-0003](0003-batch-packs-at-the-deadline.md) · Date: 2026-09-29 · NeuEra LLC*

This document is the single point of reference for what Git Game is, what we have decided, what we deliberately walked away from, and in what order we will build it. Changes to anything under "Locked" require a new ADR that supersedes the relevant line.

---

## 1. What this is

**Git Game** is an asynchronous multiplayer card game whose rules *are* Git. Players race to ship commits to a shared `main`: commit, push, pull, rebase, resolve conflicts, bluff bugs past `git blame`, and survive `push --force`. The mechanics are accurate to Git's real behaviour, so people who know Git enjoy the details and people who don't learn it without meaning to.

- **Audience:** developers, primarily on desktop, primarily in teams.
- **Format:** a game is a sequence of *days*. Each day every player sends one *pack* of ops; the *remote* processes packs in arrival order. A day is 24 hours, 5 minutes, or 60 seconds — same rules, different clock. A week-long game and a live game are the same game.
- **Where:** gitgame.online (web, PWA). Rules documents: [base-rules.md](../design/base-rules.md) and [round-resolution.md](../design/round-resolution.md).
- **Who:** published by NeuEra LLC. Open source. Built with AI, disclosed in [AI_DISCLOSURE.md](../../AI_DISCLOSURE.md).

---

## 2. Locked decisions

### Game design
1. **Async-first, real-time capable.** One engine, variable day length. Real-time is not a mode; it is a short day.
2. **No turns.** Days, packs, remote. Ops are split into *local* (never interact with other players) and *remote* (serialized by the remote in arrival order).
3. **No prompts, no interrupts.** Every choice that would need a live answer is pre-declared (`-X ours` / `-X theirs` on a pull) or pre-armed (`reflog`, `stash` as face-down traps that fire during someone else's pack).
4. **2 players is a complete game.** Up to 5. Quick-match pairs two; larger tables are private rooms or, later, scheduled.
5. **Short by default online.** The 45-minute 3–5 player format is the tabletop version. Online sessions target 10–15 minutes live, or about 7 days at 24h/day.
6. **Absence is a rule, not an error.** Missed deadline = empty pack. Two in a row = "left the company"; their commits stay on `main` and still take blame. The release date never moves.
7. **Git-accurate or not at all.** Errors are Git's real messages. Flags are real flags. If a mechanic can't be expressed in true Git terms, it doesn't go in.

### Architecture
8. **The database is the game.** Every game is an append-only event log in Postgres; state is derived. No in-memory process is a source of truth.
9. **Reconnection does not exist as a concept.** A client opening a game a week later and one opening it a second later do the same thing: fetch the view, render. Push channels only signal "refetch".
10. **Every action carries the game version it was written against.** Stale version → rejected → client refetches. The API has Git's own semantics.
11. **Process on arrival.** The remote resolves a pack the instant it lands. (Playtest question #1 may flip this to deadline-batching; that is a resolver change, not an architecture change.)
12. **Bots from day one.** A new player can start a game in five seconds against bots; bots also stand in for absent players if playtesting says they should.

### Stack
13. **Backend:** Elixir / Phoenix / Postgres / Oban. Dedicated repo — not a tenant of PlayLounge or RPS.
14. **Client:** web-first, desktop-first, terminal-style UI. Vite + PWA. Mobile via Capacitor later if demand shows up; never Flutter for this product.
15. **Identity:** GitHub OAuth primary, anonymous play as fallback with a nudge to link. Firebase Auth (RPS's `firebase_auth.ex`) as the provider layer.
16. **Notifications are the product:** push (FCM), email, Slack/Discord webhooks, daily digest. "It's your turn" is the retention loop.
17. **Lifted from existing projects:** RPS — Firebase auth, FCM notifier, reliability tiers, pure-function lifecycle pattern. PlayLounge — Vite/PWA client skeleton, private-room-by-link flow, admin/stats endpoints.

### Business
18. **Open source, AGPL, public from the first commit.** Anyone may run it; anyone hosting a modified version must publish changes. Brand, domain, and box art are separate from the code license.
19. **Revenue plan, in order:** (a) the hosted service is where people play; (b) **Orgs/Teams** — private org, team leaderboards, Slack bot, workshop mode, priced per seat; (c) the **physical box** via print-and-play → Kickstarter. A tip jar exists because it costs nothing; it is not a plan.
20. **Name:** "Git Game" and gitgame.online are the working name and domain; NeuEra LLC owns the domain. Permission was requested from Software Freedom Conservancy on 2026-09-29 and we proceed assuming it will be granted. **The name is not final**: there is a small chance of a rename, so every use of it follows [branding.md](../branding.md) and can be changed in one pass. Fallback if a rename is forced: a title from Git vocabulary (*Merge Conflict* or *Force Push*) with "a card game about Git" as the descriptive tagline the trademark policy allows.
21. **Transparent about AI.** The project is built with substantial AI assistance and says so at the repository root, in the PR template, and in commit trailers ([AI_DISCLOSURE.md](../../AI_DISCLOSURE.md)).

---

## 3. What we moved on from, and why

| We considered | We chose instead | Because |
|---|---|---|
| Building on PlayLounge's engine | Dedicated engine | PL's `GameEngine` is hard-wired to 2 players and has no hidden-information views; the game needs both. |
| Building inside RPS or `play-lounge-v2` | Dedicated repo, lifting modules | RPS is a different brand; v2 has zero commits. A fourth backend was the risk, but a shared one would have been a worse one. |
| Per-game GenServer as source of truth | Event log in Postgres | It is why PL and RPS both carry reconnection logic, forfeit timers, checkpoint-on-shutdown, and "games don't survive restart". |
| Scheduled global game nights first | Deferred, gated on a metric | RPS generated 339 nights, cancelled 319 under-filled, formed 0 tables. Scheduling aggregates demand; it can't create it. Revisit when concurrent players at a fixed hour justify it. |
| Real-time-first with a typing race | Async-first, real-time as short days | Git is asynchronous collaboration; a race is the less thematic option and the harder one to fill. |
| Turn order and out-of-turn interrupts | Packs, traps, declared strategies | Interrupts mean waiting a day for an answer. |
| 3–5 players, 45 minutes, as the online default | 2-player viable, short sessions | Matching 5 is an order of magnitude harder than 2; Mafia's 5-player minimum is part of the 0-tables story. |
| Flutter client (RPS) | Web / Vite | Wrong tool for a terminal UI aimed at desktop developers. |
| LiveKit voice | Nothing | Async games don't talk. |
| Closed source, or open source funded by donations | AGPL + hosted service + Teams + box | Secrecy protects nothing here; donations from a new dev audience are a rounding error. |
| Prototype after the idea is "locked" | Playtest the rules first | The platform is mostly known; whether the rules are fun is the actual unknown. |

---

## 4. Priorities

When two things conflict, the higher one wins.

1. **The core loop is fun.** The push race, bluffing bugs, and the `push --force` / `reflog` moment must work at the table before anything is built around them.
2. **Playable right now.** Nobody waits for a lobby. Bots, private links, a game in five seconds.
3. **Git-accurate.** Credibility with the audience is the moat. A wrong flag costs more than a missing feature.
4. **Teams are the growth loop.** A link pasted into a team's Slack is how this spreads; design private rooms with "org" in mind so Teams is a flag, not a rewrite.
5. **Revenue.** Never at the expense of 1–4.

---

## 5. How it will be developed

### Phase 0 — Playtest the rules (before any product code)
Paper deck or single-browser hotseat. Four developers, one lunch, three days of play. Must answer the three open questions in the spec: does sending last dominate; does paying for a failed push feel fair; should absent players be bot-driven.
*Exit:* the spec is revised to v1.0 and at least two people ask to play again unprompted.

### Phase 1 — Engine
Pure Elixir rules module + event log + resolver. Property-based tests over the resolver (any sequence of packs from any state yields a valid state; replaying the log reproduces it). Hotseat web client on top.
*Exit:* a full game can be played and replayed from its log.

### Phase 2 — Hosted alpha
GitHub login, private rooms by link, 24h and 60s days, notifications, terminal UI. Public repo, public roadmap. Launch: HN, r/git, a badge for READMEs.
*Exit:* games completed by strangers, not just by us.

### Phase 3 — Fill the seats
Bots, quick-match pairing, reliability tiers, digest emails, Slack/Discord webhooks.
*Exit:* a new player's first game starts in under a minute at any hour.

### Phase 4 — Orgs / Teams (first revenue)
Private orgs, team leaderboards, workshop mode, Slack bot, per-seat pricing.

### Phase 5 — The box
Print-and-play PDF of the tabletop rules → Kickstarter.

Scheduled game nights are not on this roadmap. They get a phase when concurrency data earns one.

### Working practices
- Public repo from the first commit; every decision that changes this charter is an ADR in `docs/adr/`. Conventions, workflow, and disposal rules live in [docs/](../README.md).
- Rules are data: cards, costs, and incidents live in config, not code, so playtest tweaks don't need a deploy.
- Real Git output everywhere. If unsure what Git says, run Git.
- `CHANGELOG.md` from day one (RPS practice).
- Tests are the safety net for open-source contributions; the resolver's property tests are non-negotiable before Phase 2.

---

## 6. What success looks like

Measured in **games completed**, never sign-ups.

- Phase 2: strangers finish games; ≥ 50% of started games reach a release.
- Phase 3: day-7 return rate of players who completed one game.
- Phase 4: team invites per completed game (the growth loop), and first paying org.

---

## 7. Open items

- [ ] SFC trademark response (sent 2026-09-29; nudge after ~4 weeks). Not blocking.
- [ ] Playtest questions 1–3 → spec v1.0.
- [ ] Rename per branding.md only if SFC declines.
