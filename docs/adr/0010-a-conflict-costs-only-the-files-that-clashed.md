# ADR-0010: A conflict costs only the files that clashed

*Status: Proposed · Date: 2026-10-01*

## Context

A pull that brings in a commit touching the same file as one of your unpushed commits is a conflict, settled by the strategy declared on the pull ([round-resolution.md](../design/round-resolution.md) §3, [base-rules.md](../design/base-rules.md) "Merge conflicts"). Keeping theirs discards **your whole commit**; keeping yours crosses out **their whole commit**, and its author loses all of its lines. A commit is made of cards, and its cards can be in different files: the bot builds a two-card commit whenever it can, and so do players who want more lines at once.

Git does not do that. Run in a scratch repository (Git 2.50): `git pull -X theirs` over a commit that changed `Dockerfile` and `api.py`, against an upstream commit that changed `Dockerfile`, prints `Auto-merging Dockerfile` and `Merge made by the 'ort' strategy.`, and the `api.py` change survives. `git pull --rebase` keeping the upstream side drops a commit only when nothing of it is left (`dropping … -- patch contents already upstream`). The rules are "Git-accurate or not at all" (charter decision 7), and in this case the mechanic is not.

M15a makes the output Git's: a strategy-settled pull prints what Git prints, and the game's consequence is a `#` comment. That fixes the words, but the rule underneath still takes the whole commit. Changing it changes scores, so it is a rules change and needs this ADR. It was found while comparing the live game with the mobile prototype (M15).

## Decision

When a conflict is settled, only the cards in the files that clashed are lost:

- **Keep theirs:** your cards in the clashing files are discarded. The rest of your commit stays on your branch, as a smaller commit with the same hash, and goes up with your next push. A commit with nothing left is dropped, as now.
- **Keep yours:** their cards in the clashing files are crossed out on `main` and no longer count for their author, who takes a grudge against you as now. The rest of their commit still counts.
- **Keep both** (by hand, +1 op) is unchanged.
- A plain pull that merges what remains of your commits takes a merge token, as any merge does.

## Alternatives considered

- **Keep the whole-commit rule.** It is simple to explain at a table and the simulations ran on it. But it punishes multi-file commits for a clash in one file, and its output can't be Git's without a comment explaining what Git didn't do.
- **Lose the lines, keep the cards.** Closer still to Git (a hunk is lost, not a file), but the game has no unit smaller than a card, and a card that scores nothing is worse to read than a card gone.

## Consequences

- Multi-file commits become safer, so bigger commits gain against small atomic ones. Real advice ("a conflict touches what it touches") replaces a harsher rule. The simulations in `prototypes/packs` should be rerun before acceptance, for the change in the share of conflicts that cost a whole commit, and in how often players build two-card commits.
- A commit can shrink on `main` (crossed-out cards) and on a branch (discarded cards). The view has to show a commit's cards per file for a crossed-out part to be drawn, and the client's pack model (`web/src/pack.js`) has to predict a partial loss.
- The resolver, the bot's strategy choice and the pack editor's notes change together. `rules/online.json` gets a switch, so a game keeps the rule it was created with.

## Supersedes / superseded by

None. Amends round-resolution.md §3 and base-rules.md "Merge conflicts" if accepted.
