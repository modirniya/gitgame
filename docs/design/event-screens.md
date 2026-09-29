# Event screens: the game as a sequence of moments

*Status: Draft · Last verified: 2026-09-29*

A phone shows one thing at a time. That fits this game better than a table view does: a game is a sequence of **events**, and each event is either a **question** to the player (an input screen) or a **consequence** to show them (an output screen). This document is the specification of those events and screens. The mobile prototype in [`prototypes/mobile/`](../../prototypes/README.md) implements it; the production client will be a rewrite that implements it again, properly. The spec is what carries over. The prototype does not (see [ADR-0001](../adr/0001-prototypes-are-disposable.md)).

## 1. Principles

1. **One event per screen.** A screen either asks exactly one question or shows exactly one consequence. Never both. Never two questions.
2. **The phone is the hand.** Everything on the player's screen is private by default; the shared table (`main`, tokens, both players' public state) is a separate view, one tap away, never the home screen.
3. **Consequences are shown, not told.** A rejected push is a card bouncing off `main` with Git's own words on a red banner. A pull is a pointer sliding. A force-push is cards falling off the table. Text explains; the animation is the mechanism.
4. **The bot is a character.** Its turn is a series of screens, one per op, each with its reasoning in one sentence. You watch it think.
5. **Every screen teaches.** The coach line from the desktop prototype appears on the consequence screen for the same event, in the same words. Copy is a single source shared with the spec (§6).
6. **Forward only.** The game flow moves forward; there is no back button. "Undo my last op" is an explicit action on the hub screen, offered only during the player's own turn.
7. **Accurate to Git.** Screen titles are Git commands where a command is what happened. Errors are Git's messages.

## 2. The event model

The engine is pure: `apply(state, action) → { state, events[] }`. The UI never reads state to decide what to show; it consumes the **events** and maps each to a screen. Events are written **per viewer**: another player's hand, staged cards and hidden bugs appear only as counts, and a bot's public reasoning carries only public facts. Input screens produce **actions**. This is the same shape as the online game's day log ([round-resolution.md](round-resolution.md)): there, packs are the actions and the remote's log is the events. A production client is an event-to-screen mapper for that log.

| Event | Payload | Screen |
|---|---|---|
| `RoundStarted` | round, incident | O-Incident |
| `TurnStarted` | player, ops, drawn cards, behindBy | O-YourTurn (you) · O-BotTurn (bot) |
| `Staged` | cards | O-Staged (brief) |
| `Committed` | commit, lines, hasBug (own only) | O-Committed |
| `PushAccepted` | commits, from (old tip), mainSize, roll (if a die was rolled) | O-Pushed |
| `PushRejected` | reason: `non-fast-forward` \| `flaky` \| `freeze`, behindBy, roll | O-Rejected |
| `Pulled` | rebase, mergeTokens, incoming, from, to, hadLocal (merge or fast-forward) | O-Pulled |
| `ConflictDetected` | conflicts [{ mine, theirs, files }], rebase, affordable strategies | I-Conflict |
| `ConflictResolved` | strategy, crossedOut, discarded, grudges, extraOp | O-Resolved |
| `Blamed` | target, wasBug, author, penalty | O-Blamed |
| `Reverted` | target, fixer | O-Reverted |
| `Forced` | erased, pushed, returned (to their owners' branches), revived (reverts undone), sin, oldTip, newTip | O-Forced |
| `ReflogFired` | victim, restored | O-Reflog |
| `Tagged` | by | O-CI (starts the CI sequence) |
| `TurnEnded` | player, summary, scoreDelta | O-TurnSummary |
| `BotActed` | op, reasoning, resulting events | O-BotStep (one per op) |
| `YouAreBehind` | behindBy | O-Behind (interstitial after the bot's first push of its turn) |
| `CIRan` | by (who tagged; none at the deadline), flips (ordered), bugs, productionDown | O-CI (animated), then O-Scoreboard |
| `Undone` | — | none: the hub re-renders with a one-line note |

Actions (from input screens): `stage(cards)`, `commit(message)`, `push()`, `pull({rebase})`, `resolve(strategy)`, `blame(target)`, `revert(target)`, `force()`, `tag()`, `endTurn()`, `undo()`.

## 3. Screen inventory

`I-` screens take input; `O-` screens show a consequence. "Advance" means the screen moves on by tap or, where noted, automatically.

### Frame (every screen)

A thin status bar: round `n/12` · `main x/10` · ops as three pips · **live score** "you 7 · bot 5" (a face-down bug counts as clean, so the score never leaks). A **table** tab opens the shared view as a sheet. On the player's turn, an **undo** control sits in the hub only.

### Flow

| Id | Type | Shows | Primary action | Then |
|---|---|---|---|---|
| **I-Start** | input | Title, "guided first game" toggle, difficulty later | New game | O-Incident |
| **O-Incident** | output | The incident card, large; its effect in one line | Got it | O-YourTurn |
| **O-YourTurn** | output | Two cards flipping into the hand; ops pips filling; "at the tip" or "N behind — a push would be rejected" | Play | I-Hub |
| **I-Hub** | input | The hand fanned along the bottom (tap to select); `main` as a strip at the top with your pointer and the tip; the local branch (unpushed commits) in the middle; **one row of big actions**, each with its one-line consequence in your situation, disabled ones greyed with the reason. Hint and undo live here. | Any action | Per action |
| **I-Stage** | input | Selected cards enlarged; the commit they would form (lines total, "contains a bug" warning if so) | Add N cards (1 op) | O-Staged → I-Hub |
| **I-Commit** | input | The mat's cards stacking into one commit; a commit-message field (house rule: "fix", "wip", "asdf" draw a bug) | Commit (1 op) | O-Committed → I-Hub |
| **O-Pushed** | output | Your commit flying onto the end of `main`, face-down; "the bot is now behind you" | Continue | I-Hub or O-TurnSummary |
| **O-Rejected** | output | Your commit bouncing back; red banner `! [rejected] main -> main (non-fast-forward)` (or the die, or "merge freeze"); the coach line | Continue | I-Hub |
| **I-Pull** | input | Two options as cards: **pull** (1 op, +merge token) and **pull --rebase** (2 ops, clean); if a conflict is coming, say so on both | Choose | O-Pulled or I-Conflict |
| **I-Conflict** | input | Two commit cards clashing (yours vs theirs), the file in the middle; three strategy buttons with their exact consequence (lines lost, grudge, extra op); unaffordable ones greyed with the reason | Choose | O-Resolved → O-Pulled |
| **O-Pulled** | output | Your pointer sliding along `main` to the tip; a merge token appearing, or "rebased — clean" | Continue | I-Hub |
| **I-Target** | input | `main` enlarged, scrollable; tappable cards highlighted (face-down ones for blame; flipped bugs for revert); "cancel" | Tap a card | O-Blamed / O-Reverted |
| **O-Blamed** | output | The card flipping. Bug: red, "−3 for <author>"; clean: "clean. an op and a card for nothing." | Continue | I-Hub |
| **O-Reverted** | output | A revert card landing on top; the bug greying out; "+1" | Continue | I-Hub |
| **I-Force** | input | A warning screen: what will be erased (the actual cards), the sin, the reflog risk | Force-push / Cancel | O-Forced (+ O-Reflog) |
| **O-Forced** | output | Cards falling off `main`; a sin token | Continue | O-Reflog or I-Hub |
| **O-Reflog** | output | Cards flying back on top; "free, out of turn" | Continue | I-Hub / O-BotStep |
| **I-Tag** | input | "main has 10 commits. Tag v1.0? CI flips every card." with the live score | Tag / Not yet | O-CI |
| **O-TurnSummary** | output | What you did this turn as a 3-line receipt; score delta | Watch the bot | O-BotTurn |
| **O-BotTurn** | output | "Bot's turn · 3 ops"; what it is behind by | (auto, 1s) | O-BotStep |
| **O-BotStep** | output | One op: the animation of that op on the strip + the bot's reasoning in a speech bubble. **Auto-advance 1.2s**, tap to advance, "skip bot" always visible | (auto) | next O-BotStep / O-Behind / O-Incident |
| **O-Behind** | output | Interstitial the first time the bot's push puts you behind this turn: "The tip moved. You are 1 behind. Pull before you push." | Got it | O-Incident (next round) |
| **O-CI** | output | Every face-down card on `main` flipping in order, 250ms apart; bugs turn red and tally blame; "N bugs reached production" | (auto) | O-Scoreboard |
| **O-Scoreboard** | output | Both totals, the breakdown, "what decided it" in one sentence, and both hands revealed | Play again | I-Start |
| **Table** (sheet) | output | `main` in full with labels and pointers; both players' tokens; the bot's public state (mat count, local count, hand size); the incident | Close | back |

### Guided first game

Not separate screens: a **guide layer** on the frame. It highlights the one element to tap and shows one sentence. Steps, in order: select a card → add → commit → push → watch the bot → pull (you are behind) → select → add → commit → done. If the bot didn't push (it can't if it ran out of ops), the guide says so and skips the pull step. In a guided game the bot starts with one commit ready, so its first turn is pull → push and the lesson lands.

## 4. Visual language

- **Baseline viewport** 390 × 844 (iPhone 14/15 class), portrait only. Works to 360 wide. Safe-area insets respected. Touch targets ≥ 44 pt. No horizontal page scroll; only the `main` strip scrolls sideways, with snap.
- **Cards** are the printed cards ([`rules/deck.json`](../../rules/deck.json)): a colored band per file, Courier-style file name, big `+N`, a red BUG tag on the face. Hand cards 96 × 134; strip cards 64 × 90; face-down back is a neutral hatch. The same component at every size.
- **`main`** is a horizontal strip: initial commit at the left, tip at the right with a `tip` marker, each slot labelled with file + lines + author (the announced log), pointer chips beneath. The strip auto-scrolls to the tip on change.
- **Player colors**: you teal, bot violet (from the deck's file palette family). Semantic: reject red, ok green, warn amber. Light theme on a warm neutral ground; dark theme with the same tokens.
- **Animations** (300–600 ms, `prefers-reduced-motion` → instant): push = card travels from the local branch to the end of the strip; reject = the card travels and bounces back with a shake; pull = the pointer chip slides; conflict = the two cards approach and collide, the file name flashes; force = cards after the pointer drop off the bottom; reflog = they rise back; blame/CI = a 3D flip; commit = staged cards stack into one.
- **Sound**: none in the prototype. **Haptics**: a light tap on reject and on blame-hit, if available.

## 5. Bot presentation

One screen per op. The bubble text comes from the bot's plan (its `why`), rewritten in the third person. Auto-advance at 1.2 s with a visible progress dot row ("op 2 of 3"); tap advances early; "skip bot" jumps to the end of its turn but still shows **O-Behind** if applicable, because that is the one thing the player must not miss.

## 6. Copy

All coach and consequence copy lives in one file (`copy.js` in the prototype; a locale file in production), keyed by event. The desktop prototype's coach strings are the first draft. Rules for copy: Git's exact messages where Git has one; second person; one sentence of what happened, one of what to do next; no exclamation marks except in the incident names.

## 7. What is and isn't in scope for the mobile prototype

In: everything in §3 for a 2-player game against the bot, the guide, hints, undo, a seedable shuffle (a game can be replayed from its seed). Out: online play, accounts, persistence beyond the session, 3+ players, secret tickets, roles, the incidents not in the desktop prototype.

## 8. Open questions for the playtest

The mobile prototype ([findings](../../prototypes/mobile/README.md#findings)) answers these provisionally, from simulated games and the builder's play; no other player has used it yet. `playtest.js` in the prototype records the numbers that settle each one.

1. **Is one-screen-per-op too slow on the bot's turn?** *Provisionally: not in time, yes in content.* The bot averages 2.5 ops a turn, about 4 s at 1.2 s per step, with no taps. But 45% of its steps are "staged a card" or "committed", which can't show anything because the cards are hidden. Fold stage and commit into one step and keep one screen per remote op (pull, push, blame, force, tag). *Measure:* skip-bot presses, and how each bot step was left.
2. **Does the interstitial O-Behind land the lesson, or does it become noise after game two?** *Provisionally: it lands in the guided game (99.2% of guided seeds reach the pull lesson) and is redundant after that.* It appears 4.4 times a game, and O-YourTurn states the same fact two screens later. Keep it in the guided game and the first ordinary game, then let O-YourTurn carry it. *Measure:* O-Behind reading time by game number.
3. **Do people open the Table sheet, and when?** *Provisionally: rarely.* The hub's strip already shows `main` in full; the sheet's only unique content is tokens and the bot's counts (the incident is now on the hub too). If opens stay rare, move tokens onto the hub and drop the sheet. *Measure:* Table opens per game, and the screen each was opened from.

The prototype also raised a broader answer to the question behind all three: **one event per screen is clearer for the moments (rejection, conflict, blame, force-push, reflog, CI) and too slow for the routine.** A game is about 105 screens, 36 of them round ceremony and about 40 routine ops. The next version of this spec should give each event its own screen the first time it happens in a game, and after that let routine events animate in the hub with a one-line receipt.
