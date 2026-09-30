# Round resolution: days, packs, and the remote

*Status: Draft · Last verified: 2026-09-29 · Spec v0.1, pending the Phase 0 playtest*

> There are no turns in Git. There are pushes.

The game has no turn order. It has **days**, **packs**, and a **remote** that receives packs in the order they arrive. Real-time play and week-long play are the same rules with a different day length.

## 1. The Day

- A day has a fixed length, chosen at game creation: **24h** (correspondence), **5m** (lunch), **60s** (live).
- At day start: flip one **Incident** (public), every player **draws 2** cards and receives a budget of **3 ops**. Ops don't carry over — use them or lose them.
- Each player sends **exactly one pack** per day, any time before the deadline.
- The day ends at the deadline, **or early the moment every pack has arrived**. A live game therefore runs at the speed of its slowest player; a week-long game speeds up when everyone is prompt.
- **No pack by the deadline = an empty pack ("OOO").** Two consecutive OOO days and the player has *left the company*: they send no more packs, but their commits stay on `main` and still take blame at release. History is immutable.

## 2. The Pack

A pack is an **ordered list of ops** written against the state of the remote as you last fetched it.

- List up to **4 ops**; the remote executes them in order until the **3-op budget** is spent. Ops that turn out free (see §3) don't consume budget, which is why a 4th op can exist.
- **Local ops** never interact with other players: `add`, `commit`, `commit --amend` (unpushed), `rebase -i`, and **arming a trap** (`reflog`, `stash`), which is played face-down.
- **Remote ops** are serialized by the remote: `push`, `pull`, `pull --rebase`, `push --force`, `cherry-pick`, `blame`, `bisect`, `revert`, `tag`.
- An op that is invalid at processing time **fails, and its cost is still paid.** The failure is reported in Git's own words.

## 3. Receive (resolution)

**The remote processes each pack the instant it arrives, one pack at a time, in arrival order. It never batches and never waits.** This single rule is the whole resolver; it is identical in live and async play.

| Op | Rule |
|---|---|
| `push` | Succeeds iff your pointer is at the tip. Otherwise `! [rejected] non-fast-forward`, op spent. **Free** if you have nothing to push (`Everything up-to-date`). |
| `pull` | Catches you up to the tip *as of this moment*, including packs that arrived earlier today. **Free** if `Already up to date`. Adds a merge token. |
| `pull --rebase` | Same, costs 2 ops, no merge token. |
| conflicts | A pull that brings in a commit touching the **same file** as one of your unpushed commits conflicts. It is resolved by the strategy **declared on the op**, since nobody is around to answer a prompt: `-X ours` (their commit is overwritten, its author loses those lines and gains a Grudge against you), `-X theirs` (yours is dropped), or `--resolve` (2 ops, keep both). Unspecified = `theirs`. |
| `push --force` | Overwrites `main` back to your pointer. +1 Sin. **Immediately triggers every armed `reflog`** among the players whose commits were erased: their commits are restored on top, and the trap is consumed. |
| traps | `reflog` and `stash` are armed in your own pack and **fire automatically during someone else's**. One-shot. Nobody knows what you've armed. |
| `cherry-pick`, `blame`, `bisect`, `revert`, `tag` | Resolve against the current tip at processing time, as written in [base-rules.md](base-rules.md). `bisect` is answered by the remote, not the player. |

After each pack, its outcome is appended to the public **day log** (`git log --oneline` style): what pushed, what was rejected, conflicts and their resolution, force-pushes, traps that fired. **Bug contents stay hidden** unless blamed.

## 4. Information, and the tension it creates

`fetch` is free and unlimited: at any moment you can see `main`, everyone's pointer, who has sent today's pack, and the day log so far.

- **Send first:** your push meets no competition. You act on stale-free information about yesterday, but blind about today.
- **Send last:** you see everything that happened today and can pull-then-push around it — but the tip has moved, so you need the pull, and you may inherit conflicts.

Neither is dominant. This is the same trade-off as real Git, which is the point.

## 5. The release

`main` reaching 15 commits lets anyone spend an op on `git tag v1.0`, which runs CI ([base-rules.md](base-rules.md)). **The final day also runs CI at its deadline no matter what** — Day 7 of a week-long game, Day 12 of a live one. The release date does not move.

## 6. Worked example (Day 3, 24h game)

- 07:10 — **Ana** sends `[commit auth.js+4, push]`. Tip moves to Ana.
- 09:30 — **Raj** wrote `[push]` at breakfast against yesterday's tip. Processed now: `! [rejected] non-fast-forward`. Op spent. He'll pull tomorrow.
- 22:45 — **Kim** sends `[pull -X ours, push]`. Pull brings Ana's commit; it touches `auth.js`, same as Kim's unpushed commit → conflict, resolved *ours*: Ana loses 4 lines and gets a Grudge on Kim. Kim pushes; tip is now Kim's.
- All packs in → Day 3 closes at 22:45, not midnight. Day 4 incident flips.

## 7. What the playtest must answer

1. Does sending last dominate? If so, batch remote ops at the deadline (hidden simultaneous) instead of processing on arrival — that's a one-line change in the resolver and a large change in feel.
2. Is "pay for a failed push" fun or punishing? Alternative: rejected push refunds 1 op ("at least you found out").
3. Should OOO players' packs be bot-authored rather than empty, so 2-player games survive a vacation?

**Provisional answers from simulation** ([prototypes/packs](../../prototypes/packs/README.md), bots rather than people, per [ADR-0002](../adr/0002-beta-before-human-playtest.md)):

1. **The opposite: sending first dominates.** Under arrival order the first sender wins 61% of two-player games, and each early sender wins 30% of four-player games (25% is even). The edge is tempo: the waiter must pull before it can push, most of all on day 1. The information from waiting is worth little, because a pull costs nothing when nothing moved, so an early pack written "pull, push" is never stale. §4's "neither is dominant" doesn't hold, and in 24h play the edge goes to whoever's day starts first. Batching at the deadline makes it even (50/50, 25/25) but doubles conflicts and merge tokens; with no merge token for a fast-forward, tokens come most of the way back. Recommendation: batch at the deadline, and let the beta test the feel.
2. **Keep paying.** Stale pushes come from packs written at the same moment without a pull first: 3.9 a game in a live race, about 7% of ops. A free defensive `pull` before `push` removes almost all of them (0.1 a game). A refund changes nothing unless the pack lists something after the push, and with a fallback pull it made results worse. The pack editor should pre-fill `pull` before `push`.
3. Not simulated: it is about how absence feels to the players who stay.

The simulation also found five ambiguities in this doc (the cost of `--resolve`, the release size, a force-push or blame that finds nothing to act on, and whether arming a reflog takes a pack slot), listed in the prototype's README for v1.0.
