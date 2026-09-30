# Base rules: the tabletop game

*Status: Draft · Last verified: 2026-09-29 · Rules v0.2*

This is the game as designed for a table: 2–5 players, about 45 minutes, everyone works on the same repo, and only one player's name ends up on the release. The online game derives from it — [round-resolution.md](round-resolution.md) replaces turns with days and packs and pre-declares every choice that would need a live answer. Where the two disagree, the online doc wins for the online game, and this doc wins for the box.

## Components

The exact deck lives in [`rules/deck.json`](../../rules/deck.json); the printable version is built from it into [`tabletop/print-and-play.pdf`](../../tabletop/print-and-play.pdf). In summary: 60 commit cards (5 files × 12 sizes, 12 of them bugs), 33 command cards, 8 incidents, 6 secret tickets, 4 optional roles, one initial-commit card, and merge / grudge / sin tokens.

**Setup:** the initial commit starts `main`; every pointer starts on it. Commit and command cards are shuffled into one draw deck; each player gets 5 cards and one face-down secret ticket. The release comes at 10 commits with 2 players, 12 with 3, 15 with 4 or 5.

## The core idea

Each player is a developer racing to ship code to a shared `main`. The central rule comes straight from Git:

> **You can't push if you're behind.**

When someone pushes first, everyone else's local copy is out of date. They have to pull, and pulling can cause merge conflicts. That race drives the whole game.

## The table

```
REMOTE (centre of table)
main:  ●──●──●──●──●──●      face-down commit cards
             ▲     ▲  ▲
           Ana   Raj  Kim     each player's origin/main pointer

YOUR AREA
  Hand          = working directory
  Staging mat   = staged cards (face down)
  Local branch  = your unpushed commits
```

- **Commit cards** each name a **file** (`auth.js`, `api.py`, `styles.css`, `Dockerfile`, `README.md`) and a number of **lines** (+1 to +8). Lines are points.
- About **20% of commit cards are bugs.** A bug has the same back as any other card, so once it's played face-down nobody else can tell. You can see your own bugs in your hand, and you can push them anyway.
- **Command cards** are Git commands with special effects.

## Your turn: 3 ops

Draw 2 cards at the start of your turn ("new tickets came in"), then spend 3 ops:

| Op | Cost | Effect |
|---|---|---|
| `git add` | 1 | Move any number of cards from hand to staging, face down |
| `git commit` | 1 | All staged cards become **one commit** on your local branch |
| `git push` | 1 | Move your commits to remote `main`. **Rejected** if your pointer isn't at the tip |
| `git pull` | 1 | Catch up to the tip. If you had unpushed commits, take a merge token (messy history, −1 at the end). With nothing of yours to merge it is a fast-forward in Git: no merge commit, no token |
| `git pull --rebase` | 2 | Catch up with clean history, no penalty |
| Play a command | 1 | See below |

**Hand limit:** at the end of your turn, if you hold more than 10 cards, discard down to 10.

**The commit-size gamble:** big commits score more lines at once, but if one bug is inside, `git blame` penalises the whole commit. Small atomic commits are safer but cost more ops. Real engineering advice becomes a game decision.

### Merge conflicts

When you pull, check whether any of your unpushed commits touch the **same file** as a commit you're pulling in. If so, you have a conflict. Pick one:

- **Ours:** keep your commit. The other commit is overwritten, its author loses those lines and takes a **Grudge token** against you.
- **Theirs:** discard your commit.
- **Resolve manually** (+1 op): keep both.

## Command cards

| Card | Effect |
|---|---|
| `cherry-pick` | Copy any pushed commit onto your branch. Git keeps the original author on a cherry-pick, so if you copied a bug the blame lands on them, not you |
| `push --force` | Overwrite remote `main` with your branch, erasing everyone's commits since your pointer. Take a **Sin token** |
| `reflog` | Counter, free to play, even out of turn: undo a force push. Erased commits return on top of `main` |
| `git blame` | Flip one commit on `main`. If it's a bug, its author takes −3 now |
| `git bisect` | Choose a range of `main`. The owner of any bug in it must say whether the bug is in the first or second half. Repeat until found |
| `revert` | Neutralise a bug by adding an inverse commit on top. +1 for fixing it |
| `stash` | Protect up to 3 hand cards from discard effects |
| `commit --amend` | Swap a card in your last **unpushed** commit. On a pushed commit it's a history rewrite: +1 Sin |
| `rebase -i` | Squash 2+ of your commits into one: +2 lines for clean history |
| `checkout <sha>` | Attack: the target is in **Detached HEAD**; their next commit is orphaned unless they spend an op on `git switch -c` |

## Incidents

Flip one every round:

- **Friday Deploy:** everyone must push this round or lose 1 op next round
- **left-pad Unpublished:** every `Dockerfile` commit on `main` becomes a bug
- **Merge Freeze:** nobody can push this round
- **Flaky CI:** the next player to push rolls a die; on 1–2 the push is rejected
- **Standup Ran Long:** everyone gets 2 ops this round
- **Stack Overflow Is Down:** no command cards this round
- **Hackathon:** everyone gets 4 ops this round
- **Security Audit:** each player flips one commit on `main` that isn't theirs; blame applies

## The release

Once `main` has 15 commits, any player may play `git tag v1.0`. That triggers **CI**:

1. Flip every commit on `main`.
2. For each bug, `git blame` penalises the author: −3, or −5 if the bug was hidden inside a squashed commit.
3. **If 4 or more bugs reach prod, production goes down:** the release fails, and the player with the **least blame** wins.
4. Otherwise: lines shipped − blame − merge tokens − Sins, plus **secret ticket** bonuses:
   - *Linear History Purist:* zero merge tokens
   - *Owns Auth:* 3 `auth.js` commits on `main`
   - *Release Manager:* be the one who tags v1.0
   - *Chaos Agent:* each of your bugs on `main` scores +3 instead of −3
   - *Documentation Hero:* 3 `README.md` commits on `main`
   - *Small Batches:* never commit more than one card at a time

## Optional roles

- **The Intern:** may push once per game without being up to date. Starts with 2 extra bugs; immune to the first blame ("they're learning").
- **The Rebase Zealot:** `pull --rebase` costs 1, plain `pull` costs 2.
- **The Senior Reviewer:** may peek at any face-down commit once per round.
- **The 10x Dev:** 4 ops, but every commit must hold at least 3 cards.

**House rule:** say a real commit message out loud when you commit. "fix", "wip", or "asdf" draws a bug.

## Why it works

- **Tension:** pushing first is powerful, and everyone else then has to pull and deal with conflicts.
- **Bluffing:** push a bug to score now and hope nobody runs `git blame` before the release.
- **Take-that without cruelty:** `push --force` is devastating, but `reflog` undoes it — a comeback moment.
- **Accurate to Git:** cherry-pick keeping the author, "don't rewrite public history", Detached HEAD, and bisect's halving all behave like the real thing.
