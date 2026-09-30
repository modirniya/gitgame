# packs

*Status: Done · Last verified: 2026-09-29*

**Question:** in the online model ([round-resolution.md](../../docs/design/round-resolution.md)), does sending your pack last dominate (playtest question 1), and is paying for a rejected push punishing (question 2)? [ADR-0002](../../docs/adr/0002-beta-before-human-playtest.md) asks for a simulation of each open rules question before Phase 1 code depends on it; this is the one for questions 1 and 2.

**Run:** `node sim.js` prints the tables below (about 3.5 minutes; 4,000 games per condition), and `node sim.js --detail` prints the day-by-day and batching diagnostics (about 40 seconds; 2,000 games per row). **Test:** `node smoke-test.js` checks the resolver's rules and plays 480 games across every variant (under a second).

## Method

- `remote.js` is the online rules as a resolver. There are no turns. Each day an incident flips, everyone draws 2, and every player sends one pack of up to 4 ops. The remote processes each pack when it arrives, running it until its 3-op budget is spent. `pull` and `push` are free when there is nothing to do, a failed op still costs its ops, a conflict is resolved by the strategy declared on the pull (unspecified is `theirs`), and `reflog` is a trap armed in advance that fires during someone else's force-push. The deck, the scoring and the 12-day release are those of the prototypes. Cherry-pick, bisect, stash, amend, `rebase -i` and checkout are not in this deck.
- `packer.js` writes a whole day's pack from the state the player last fetched. It is the mobile bot's policy turned from "the next op" into "the day". A *defensive* writer puts a `pull` before every `push`: it is free when nothing moved, and insurance when something did. A *naive* writer pulls only when it already knows it is behind.
- `sim.js` gives every player a timing strategy, and packs resolve in send order:
  - **early:** fetch and send at dawn.
  - **late:** wait until everyone else has sent, then send near the deadline, seeing everything.
  - **random:** send at a random moment, with `compose` between fetch and send.
  - **race:** everyone fetches when a live day opens and sends when their pack is written.
  
  Seats rotate between games, so the deal can't favour a strategy. **Batch** is question 1's alternative: everyone writes against the day's start, and the remote resolves all packs at the deadline in random order.

**Caveats.** These are bots, not people. Everyone plays the same greedy policy; a person who waits might use what they see better than this writer does (for timing a blame or a tag). And the model settles who *wins*, not what feels fair or fun. The rules had to be read in a few places where the doc is ambiguous (see "Spec gaps" below).

## Results

`non-fast-forward rejections` are stale pushes (Git's `! [rejected]`). `ops lost` also includes flaky-CI rejections, which is why it isn't zero when nothing went stale.

### Q1 · Does sending last dominate? (2 players, 4,000 games each; an even split is 50%)

| condition | first strategy wins | second strategy wins | non-fast-forward rejections / game | ops lost to rejections | pushes landed / game | days | merge tokens / game |
|---|---|---|---|---|---|---|---|
| early vs late (24h: one sends at dawn, the other waits for them) | early: 61.0% ±1.5 | late: 39.0% ±1.5 | 0.00 | 0.47 | 10.39 | 10.2 | 2.6 |
| early vs random (24h) | early: 61.4% ±1.5 | random: 38.6% ±1.5 | 0.00 | 0.47 | 10.41 | 10.1 | 2.7 |
| late vs late (24h: both wait, the deadline decides the order) | late: 50.0% ±1.1 | late: 50.0% ±1.1 | 0.00 | 0.47 | 10.49 | 9.8 | 2.6 |

Why: pushes landed and merge tokens per player, per game.

| condition | strategy | wins | pushes landed | merge tokens | final score |
|---|---|---|---|---|---|
| arrival order (today) | early | 61.0% | 5.57 | 1.39 | 37.9 |
| arrival order (today) | late | 39.0% | 4.81 | 1.24 | 32.0 |
| batched at the deadline | early | 51.3% | 5.38 | 2.75 | 33.7 |
| batched at the deadline | late | 48.7% | 5.34 | 2.73 | 33.1 |

Share of games in which each player landed a push, days 1-4 (2,000 games): early 77%, 73%, 54%, 61%; late 17%, 72%, 47%, 53%.

### Q1 with 4 players (two of each; an even split is 25%)

| condition | first strategy wins | second strategy wins | non-fast-forward rejections / game | ops lost to rejections | pushes landed / game | days | merge tokens / game |
|---|---|---|---|---|---|---|---|
| early ×2 vs late ×2 | early: 30.1% ±1.0 | late: 19.9% ±0.9 | 0.00 | 0.55 | 16.63 | 10.8 | 6.7 |
| random ×2 vs late ×2 | random: 30.2% ±1.0 | late: 19.8% ±0.9 | 0.00 | 0.55 | 16.62 | 10.8 | 6.7 |

### Q1's alternative: batch at the deadline

| condition | wins, first / second strategy | merge tokens / game | conflicts / game | pushes landed / game | days |
|---|---|---|---|---|---|
| 2 players, arrival order (today) | early 60.3% / late 39.7% | 2.6 | 1.22 | 10.4 | 10.2 |
| 2 players, batched | early 50.5% / late 49.5% | 5.5 | 2.56 | 10.7 | 10.0 |
| 2 players, batched, no merge token for a fast-forward | early 50.1% / late 49.9% | 3.7 | 2.56 | 10.7 | 9.9 |
| 4 players, arrival order (today) | early 30.1% / late 19.9% | 6.7 | 4.69 | 16.7 | 10.8 |
| 4 players, batched | early 24.8% / late 25.2% | 15.3 | 10.06 | 16.6 | 11.1 |
| 4 players, batched, no merge token for a fast-forward | early 24.7% / late 25.3% | 9.0 | 9.93 | 16.7 | 10.8 |

(2,000 games per row.)

### Q2 · Pay for a rejected push, or refund it? (stale packs: a live race, and a 24h game at random times)

| condition | first strategy wins | second strategy wins | non-fast-forward rejections / game | ops lost to rejections | pushes landed / game | days | merge tokens / game |
|---|---|---|---|---|---|---|---|
| live race, naive packs, pay (today) | race: 50.0% ±1.1 | race: 50.0% ±1.1 | 3.90 | 4.41 | 10.21 | 10.5 | 2.6 |
| live race, naive packs, refund | race: 50.0% ±1.1 | race: 50.0% ±1.1 | 3.90 | 0.00 | 10.21 | 10.5 | 2.6 |
| live race, naive + fallback pull, pay (today) | race: 50.0% ±1.1 | race: 50.0% ±1.1 | 5.38 | 5.92 | 10.46 | 10.9 | 5.0 |
| live race, naive + fallback pull, refund | race: 50.0% ±1.1 | race: 50.0% ±1.1 | 6.51 | 0.00 | 9.77 | 10.4 | 6.9 |
| live race, defensive packs, pay (today) | race: 50.0% ±1.1 | race: 50.0% ±1.1 | 0.10 | 0.58 | 10.72 | 10.0 | 5.5 |
| live race, defensive packs, refund | race: 50.0% ±1.1 | race: 50.0% ±1.1 | 0.10 | 0.00 | 10.72 | 10.0 | 5.5 |
| live race, 4 players, defensive, pay (today) | race: 25.0% ±0.7 | race: 25.0% ±0.7 | 0.33 | 0.89 | 16.71 | 11.1 | 15.2 |
| live race, 4 players, defensive, refund | race: 25.0% ±0.7 | race: 25.0% ±0.7 | 0.33 | 0.00 | 16.71 | 11.1 | 15.2 |
| 24h random times, 1h to write, naive, pay (today) | random: 50.0% ±1.1 | random: 50.0% ±1.1 | 0.56 | 1.03 | 10.42 | 9.9 | 2.4 |
| 24h random times, 1h to write, naive, refund | random: 50.0% ±1.1 | random: 50.0% ±1.1 | 0.56 | 0.00 | 10.42 | 9.9 | 2.4 |
| 24h random times, 1h to write, naive + fallback, pay (today) | random: 50.0% ±1.1 | random: 50.0% ±1.1 | 0.57 | 1.04 | 10.51 | 10.0 | 2.6 |
| 24h random times, 1h to write, naive + fallback, refund | random: 50.0% ±1.1 | random: 50.0% ±1.1 | 0.57 | 0.00 | 10.47 | 9.9 | 2.8 |

The win columns read 50% here because both players use the same strategy; what differs between rows is rejections, ops lost, pushes landed and tokens.

### The fast-forward finding from prototypes/mobile, in the pack model (2 players, live race, defensive packs)

| condition | non-fast-forward rejections / game | pushes landed / game | days | merge tokens / game |
|---|---|---|---|---|
| a plain pull always takes a merge token (today) | 0.10 | 10.72 | 10.0 | 5.5 |
| a fast-forward pull takes no token | 0.09 | 10.72 | 9.9 | 3.7 |

## Findings

### Q1: sending *first* dominates, not sending last

Under arrival order the player who sends first wins 61% of two-player games; with four players each early sender wins 30% where 25% is even. It is tempo, not information:
- **Day 1 does most of it.** The first sender lands a push on day 1 in 77% of games, the waiter in 17%, because the waiter must spend an op pulling the first commit before it can push.
- **After that the edge is small but lasting.** Each day, whoever pushes first makes the other pull. Over a game that is about 0.8 more pushes, without more merge tokens.
- **Waiting buys little.** It was supposed to buy never sending a stale pack, but a defensive pull already gives that for free: early packs had no stale rejections at all.

`round-resolution.md` §4's claim that "neither is dominant" doesn't hold in this model.

**Consequence for an async-first game:** in 24h play, whoever's day starts first (a time zone, an alarm clock) gets the edge. That is a fairness problem, and a strong incentive to send the moment a day opens.

**The charter's alternative fixes it at a price.** Batching packs at the deadline gives 50.5 / 49.5 with two players and 24.8 / 25.2 with four, but conflicts double (1.2 → 2.6 per game with two players, 4.7 → 10.1 with four) and so do merge tokens, because everyone writes blind to today's pushes. Adding the merge-token fix from `prototypes/mobile` (no token for a fast-forward) brings tokens back most of the way (5.5 → 3.7; 15.3 → 9.0), but not conflicts.

**Recommendation** (the maintainer's call): **batch at the deadline**, with no merge token for a fast-forward. The game is async-first and fairness across time zones matters more there than in a live game. Watch in the beta whether doubled conflicts feel like the "take-that" the charter wants, or like noise. ADR-0002 already requires the switch to be one resolver change, so the beta can try both.

### Q2: paying for a rejected push punishes one mistake, and the fix is free

- **Stale pushes happen only when packs are written at the same time and nobody pulled first.** In a live race with naive packs that is 3.9 rejections a game, about 7% of all ops. In a 24h game at random times it is 0.56.
- **A defensive `pull` before every `push` removes almost all of them** (0.10 a game), because a pull costs nothing when nothing moved. That is exactly Git's lesson: pull before you push.
- **A refund changes nothing unless the pack lists something after the push.** When it does (a fallback pull), the refund made things worse in this model: 6.5 rejections a game instead of 5.4, and fewer pushes landed. Players who catch up after a rejection write fewer pulls the next morning.

**Recommendation:** keep paying for a rejected push. It is Git-accurate and small once the pack editor pre-fills `pull` before `push`, which the client should do. Whether it *feels* punishing is still the beta's question.

### The fast-forward finding holds here too

No merge token for a fast-forward pull cuts tokens from 5.5 to 3.7 per two-player live game, with no change to who wins or how long games run.

### Spec gaps found while writing the resolver

`round-resolution.md` needs these settled for v1.0. The choice made here is in brackets.
- `--resolve` is "2 ops": is that in total, or on top of the pull? [On top: a plain pull resolving by hand costs 2, a rebase 3.]
- The release: this doc says 15 commits, base-rules says 10 / 12 / 15 by player count. [Base rules.]
- A force-push with nothing ahead of your pointer. [It fails, the op is paid, the card is kept.]
- A blame whose target was flipped earlier the same day. [It fails, the op is paid, the card is kept.]
- Arming a reflog is free but takes one of the 4 pack slots. [It does.]
- Question 3 (should absent players be bot-driven) is about how absence feels to the people who stay, and isn't simulated here.
