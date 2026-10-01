# Round resolution: days, packs, and the remote

*Status: Draft · Last verified: 2026-09-29 · Spec v0.2, pending the beta ([ADR-0002](../adr/0002-beta-before-human-playtest.md))*

> There are no turns in Git. There are pushes.

The game has no turn order. It has **days**, **packs**, and a **remote** that receives every player's pack for the day and resolves them together when the day closes. Real-time play and week-long play are the same rules with a different day length. The numbers below live in [`rules/online.json`](../../rules/online.json); where this doc and the data disagree, the data is wrong.

## 1. The Day

- A day has a fixed length, chosen at game creation: **24h** (correspondence), **5m** (lunch), **60s** (live).
- At day start: flip one **Incident** (public), every player **draws 2** cards and receives a budget of **3 ops**. Ops don't carry over — use them or lose them.
- Each player sends **exactly one pack** per day, any time before the deadline, and may replace it until then.
- The day closes at the deadline, **or early the moment every pack has arrived**. A live game therefore runs at the speed of its slowest player; a week-long game speeds up when everyone is prompt.
- At the end of the day, anyone holding more than **10 cards** discards down to 10. Nobody is there to choose, so a pack may declare which cards to give up. Whatever it doesn't cover goes by a fixed, public rule: the smallest commit cards first, bugs before clean ones, command cards last.
- **The cards in play.** Online games use the part of the deck the simulations tested: `git blame`, `revert`, `push --force` and `reflog`, and the Flaky CI, Standup Ran Long, Stack Overflow Is Down and Hackathon incidents, shuffled with two quiet days. `rules/online.json` lists them. The rest of the [tabletop deck](base-rules.md) comes online one card at a time.
- **No pack by the deadline = an empty pack ("OOO").** Two consecutive OOO days and the player has *left the company*: they send no more packs, but their commits stay on `main` and still take blame at release. History is immutable.

## 2. The Pack

A pack is an **ordered list of ops** written against the remote as it stood when the day opened.

- List up to **4 ops**; the remote executes them in order until the **3-op budget** is spent. Ops that turn out free (see §3) don't consume budget, which is why a 4th op can exist. An op that no longer fits the remaining budget is not run, and the pack stops there.
- **Local ops** never interact with other players: `add`, `commit`, `commit --amend` (unpushed), `rebase -i`, and **arming a trap** (`reflog`, `stash`), which is played face-down. Arming is free but takes one of the 4 slots.
- **Remote ops** are resolved against the remote at resolution time: `push`, `pull`, `pull --rebase`, `push --force`, `cherry-pick`, `blame`, `bisect`, `revert`, `tag`.
- An op that is invalid at resolution time **fails, and its cost is still paid.** The failure is reported in Git's own words. A command card whose op fails (a `blame` on a commit someone flipped earlier in the day, a `push --force` with nothing ahead of your pointer) stays in your hand.

## 3. Resolution

**When the day closes, the remote resolves every pack of the day, one whole pack at a time, in a random order drawn from the game's seed.** Nobody can see another pack before it resolves, so the order in which packs were *sent* doesn't matter. ([ADR-0003](../adr/0003-batch-packs-at-the-deadline.md) records why; `rules/online.json` keeps the alternative, resolving each pack the moment it arrives, as a setting for the beta to compare.)

| Op | Rule |
|---|---|
| `push` | Succeeds iff your pointer is at the tip. Otherwise `! [rejected] non-fast-forward`, op spent. **Free** if you have nothing to push (`Everything up-to-date`). |
| `pull` | Catches you up to the tip *as of this moment in the resolution*, including packs resolved before yours today. **Free** if `Already up to date`. Takes a merge token **only if you had unpushed commits to merge**. A pull with nothing of yours to merge is a fast-forward in Git, and makes no merge commit. |
| `pull --rebase` | Same, costs 2 ops, never a merge token. |
| conflicts | A pull that brings in a commit touching the **same file** as one of your unpushed commits conflicts. It is resolved by the strategy **declared on the op**, since nobody is around to answer a prompt: `-X ours` (their commit is overwritten, its author loses those lines and gains a Grudge against you), `-X theirs` (yours is dropped), or `--resolve` (keep both, **+1 op** on top of the pull: 2 for a plain pull, 3 for a rebase). Unspecified = `theirs`. The names here are the game's: *ours* keeps your commit, *theirs* keeps theirs. Git names the sides from where the merge runs, so under `--rebase` keeping theirs is `git pull --rebase -X ours`, and resolving by hand has no flag (Git stops at the conflict); what the client prints is Git's. |
| `push --force` | Overwrites `main` back to your pointer. +1 Sin. **Immediately triggers every armed `reflog`** among the players whose commits were erased: one armed trap restores *all* of its owner's erased commits on top, and is consumed. Erased commits of players without a trap go back to their owners' local branches. |
| traps | `reflog` and `stash` are armed in your own pack and **fire automatically during someone else's**. One-shot. Nobody knows what you've armed. |
| `cherry-pick`, `blame`, `bisect`, `revert`, `tag` | Resolve against the current tip at resolution time, as written in [base-rules.md](base-rules.md). `revert` is a commit you push, so it needs you at the tip. `bisect` is answered by the remote, not the player. |

After each pack, its outcome is appended to the public **day log** (`git log --oneline` style): what pushed, what was rejected, conflicts and their resolution, force-pushes, traps that fired. **Bug contents stay hidden** unless blamed.

## 4. Information, and the tension it creates

`fetch` is free and unlimited: at any moment you can see `main`, everyone's pointer, who has sent today's pack (not what is in it), and every day log so far.

Because the day's packs resolve together, everyone writes blind to today's moves, and nobody can wait to see them. What you know is where yesterday left the remote. The tension is a guess about the others:
- **Push as it stands:** you are at the tip now, but if anyone resolves before you and pushes, your push is rejected.
- **Pull first:** a `pull` before your `push` costs nothing if nobody pushed ahead of you, and 1 op if someone did. It is always worth writing, as it is in real Git, so the pack editor writes it by default.
- **Declare your conflict strategy:** you can see which files your unpushed commits touch, and which files others have committed but not pushed. `-X ours` is a bet.

## 5. The release

`main` reaching the release size (**10** commits with 2 players, **12** with 3, **15** with 4 or 5, as in [base-rules.md](base-rules.md)) lets anyone spend an op on `git tag v1.0`, which runs CI ([base-rules.md](base-rules.md)). **The final day also runs CI when it closes, no matter what**: Day 7 of a 24h game, Day 12 of a 5m or 60s one. The release date does not move.

## 6. Worked example (Day 3, 24h game, three players)

- 07:10 — **Ana** sends `[add auth.js+4, commit, pull, push]`.
- 09:30 — **Raj** sends `[pull, push]`: he has a commit from yesterday to ship.
- 22:45 — **Kim** sends `[pull -X ours, push]`: her unpushed commit touches `auth.js`, and she expects Ana to push one too.
- 22:45 — all packs are in, so Day 3 closes now rather than at midnight. The seed draws the order **Raj, Kim, Ana**:
  - **Raj:** his pull is free (nobody has moved the tip today), and his push lands.
  - **Kim:** her pull brings in Raj's commit (1 op; no conflict, since he touched `api.py`), and her push lands.
  - **Ana:** her `add` and `commit` run, then her pull brings in Raj's and Kim's commits (1 op). Kim's touches `auth.js`, like Ana's new commit, which is a conflict, and Ana declared nothing, so `theirs`: Ana's commit is dropped. Her `push` no longer fits the budget.
- Day 4's incident flips.

## 7. What the playtest must answer

1. ~~Does sending last dominate?~~ **Decided for v0.2:** under arrival order *sending first* dominated in simulation (61:39), so packs now resolve together at the deadline ([ADR-0003](../adr/0003-batch-packs-at-the-deadline.md)). The beta should check how the doubled conflicts feel, and can compare arrival order using the setting.
2. ~~Is "pay for a failed push" fun or punishing?~~ **Decided for v0.2:** keep paying. Stale pushes come from packs written without a pull first, and a pull costs nothing when nothing moved; the pack editor writes `pull` before `push` by default. A refund helped nothing in simulation. The beta should check how a rejection *feels*.
3. Should OOO players' packs be bot-authored rather than empty, so 2-player games survive a vacation? **Open.** It is about how absence feels to the players who stay, and needs the beta.

## History

- v0.2 (2026-09-29): which cards the hand limit takes when a pack doesn't say; a pack stops at the first op that doesn't fit. Settled while writing the server's resolver.
- v0.2 (2026-09-29): packs resolve together at the deadline (ADR-0003); no merge token for a fast-forward pull; hand limit of 10; `--resolve` costs +1; failed command cards stay in hand; arming takes a pack slot; release size by player count. Evidence: [prototypes/packs](../../prototypes/packs/README.md).
- v0.1: arrival-order resolution, pending the Phase 0 playtest.
