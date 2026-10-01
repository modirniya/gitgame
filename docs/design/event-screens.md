# Event screens: the game as a sequence of moments

*Status: Draft · Last verified: 2026-09-30*

A phone shows one thing at a time. That fits this game better than a table view does: a game is a sequence of **events**, and each event is either a **question** to the player (an input screen) or a **consequence** to show them (an output screen). This document is the specification of those events and screens. The mobile prototype in [`prototypes/mobile/`](../../prototypes/README.md) implemented it first; the production client in [`web/`](../../web/README.md) implements it again for the online game, and §9 records where it differs. The spec is what carries over. The prototype does not (see [ADR-0001](../adr/0001-prototypes-are-disposable.md)).

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
| **I-Hub** | input | The hand fanned along the bottom (tap to select); `main` as a strip at the top with your pointer and the tip; the local branch (unpushed commits) in the middle; **one row of big actions**, each with its one-line consequence in your situation, disabled ones greyed with the reason. Hint and undo live here. Sending a pack that leaves ops unspent first says how many are left and what could still spend them; a second tap sends it anyway. | Any action | Per action |
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
- **Bigger screens** keep the event screen phone-shaped, because one question or one consequence at a time is the point. From 600 px wide the column widens, cards grow, and the hub's four ops sit in one row. From about 1000 × 560 the Table stops being a sheet and becomes a panel beside the screen, with `main` laid out in full (wrapping, not scrolling) and a log of what has happened. Enter answers with the primary button; Escape cancels, closes the sheet or skips the bot.
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

## 9. In the online client

The production client ([`web/`](../../web/README.md), M7) plays the online game, days and packs, not the prototype's alternating turns. The spec carries over with these differences, each following from that or from §8's findings.

- **The events are the remote's day log** (`server/lib/gitgame/games/projection.ex`), not the prototype's engine events. The mapper (`web/src/moments.js`) turns a day log, as the remote sends it to one reader, into **moments**: one per op, written as a terminal would show it (`ana@main $ git pull -X theirs`, then Git's output), with the coach line from `web/src/copy.js`.
- **§8's finding is the rule, kept with the prototype's rhythm.** Your routine ops are answered on the hub as you write them (I-Hub, below). When the day closes it plays back step by step (`web/src/playback.js`), each step on `main` as the remote left it at that point, folded from the table as the day opened (each closed day in the view carries it) and the day's public events, with that step's motion: every remote op of yours (a push landed, rejected or not run because the budget ran out, a pull, a conflict); everyone else's remote ops, their local ones folded into one step ("built a commit") and a pull that changed nothing folded into what follows, moving on by themselves after 1.2 s; and the big moments (a rejection, a conflict, blame, a revert, a force-push, a reflog, the tag, CI, someone leaving), which wait for a tap. The day ends on its receipt (`web/src/summary.js`, the prototype's O-TurnSummary and O-Behind as one screen): the order the remote ran the packs in, what each op of yours did, the score it changed, and where you now stand. "Skip" goes to the day's receipt, never past it.
- **The bot is a character on its steps** (`web/src/bot.js`): its avatar, its ops counted as dots, and a speech bubble. The bot writes its pack when the day opens, so its own `why` can't know what the day did to it; the bubble is written from the why's intent and the step's outcome, from public facts only ("It meant to ship its commit, but the pull before the push dropped it: nothing was left to push").
- **No bot turn, no O-BotTurn.** Everyone's pack resolves at once when the day closes ([ADR-0003](../adr/0003-batch-packs-at-the-deadline.md)), so opening a game plays back what happened since you last looked: each closed day, step by step, ending on its receipt, then today's incident with your draws, your ops and where you stand (`web/src/catchup.js`). A minute away and a week away are the same thing. During a day's playback the frame shows that day, `main` as the step left it, and the score as the day opened; the receipt shows the change.
- **I-Hub writes a pack, not a turn.** Ops are listed as commands with what each will cost now and at most, since another pack may land first. A pull is written before each push by default, and a conflict is flagged before sending. Undo is removing an op from the pack before it is sent; a sent pack can be replaced until the day closes. The hub draws your branch as the pack would leave it (staged, to push, and what it pushes waiting past the tip, marked "your push"), so each op written is answered on the table at once, as the prototype answered each op; the day's resolution decides what lands. The four core actions sit at the thumb; a command card's action appears when that card is picked from the hand, and the tag once `main` is the release size.
- **I-Pull and I-Conflict are not screens.** A strategy is declared on the pull, because nobody can be asked in the middle of the night (charter decision 3). It is offered by what it does (keep theirs, keep mine, keep both by hand) and printed as Git's flag, which swaps under `--rebase`. What a rule takes from someone (a dropped commit, a crossed-out one, a merge token, what a force-push erased) is printed as a `#` comment, never as a line Git would print.
- **The Table** is a sheet on phones and a panel beside the hub on wide screens, as §4 says, with the last day's log as a transcript.
- **Replays** (`#/r/<id>`) show any game day by day, each day the view the remote folds from the log.
- **The guided first game is dealt, not given a head start** (M15h). Instead of a bot with a commit ready, the remote chooses the game's seed (`server/lib/gitgame/games/guided.ex`) so that day 1 is a full day, a clean card is in your hand, and your pack resolves before the bot's, so the push the guide has you write lands; the rules are those of any game.

