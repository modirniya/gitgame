# mobile

*Status: Done, awaiting a human playtest · Last verified: 2026-09-29*

**Question:** does one-event-per-screen on a phone make the game clearer and more fun than the table view?

**Spec:** [docs/design/event-screens.md](../../docs/design/event-screens.md). **Plan:** [PLAN.md](PLAN.md) (executed).

**Run:** `python3 -m http.server` in this folder, then open http://localhost:8000 on a phone, or at phone size. ES modules need a server; `file://` won't load them. To play on a phone on the same Wi-Fi, open `http://<this machine's IP>:8000`.

Add `?seed=123` to replay a shuffle, and `?debug` to expose the router as `window.gitgame` for driving a game from the console. The scoreboard's "playtest numbers" and `window.gitgamePlaytest()` show what `playtest.js` recorded on the device.

**Test:** `node smoke-test.js`. It plays 800 games against the bot (400 competent, 400 random) plus 200 random-vs-random through the pure engine. It checks the pointer invariant after every action, replays every game from its seed, and checks event coverage. It renders every screen for every event of 300 games and walks the guided game over 500 seeds. It runs in about 20 s and exits non-zero on any failure.

## Files

- `engine.js`: the rules as a pure function: `createGame({ seed, guided })`, `apply(state, action) → { state, events }`, `scores`, `legalActions`, `winner`.
- `bot.js`: `plan(state, id)` returns `{ action, why }` (the desktop policy); `botStep(state)` plays one op and wraps it in a `BotActed` event.
- `copy.js`: every string the player reads, keyed by event or reason, including Git's own output.
- `router.js`: `screensFor(events)` maps events to screens; the queue, auto-advance and "skip bot".
- `frame.js`: the status bar and the Table sheet, drawn from the state of the screen being shown.
- `view.js`: the card (one component at every size), the `main` strip, pointer chips, ops pips.
- `screens.js`, `hub.js`, `outcomes.js`: the input screens and the registry, the hub, and the output screens.
- `guide.js`: the guided first game, as a pure step reducer plus the overlay that highlights one element and says one sentence.
- `motion.js`: the animations of spec §4, FLIP for card movement, off under `prefers-reduced-motion`.
- `playtest.js`: per-game numbers for the open questions, kept on the device.
- `index.html`, `styles.css`: the shell and every style, light and dark.

The plan's file list had one `screens.js`; the screens were split into three files, and `frame.js`, `view.js`, `motion.js` and `playtest.js` were added, to keep each file to one idea.

## Findings

**Nobody but the builder has played this yet.** Everything below comes from three sources: measurements over thousands of simulated games (`screensFor` applied to real event streams), full games driven through the real UI in the built-in browser at 375 × 812 and 360 × 740, and one guided turn played with real taps. Each item says which. The human playtest should read `playtest.js`'s numbers against the predictions here.

### The answer so far: one event per screen is clearer for the moments, and too slow for the routine

The screens that show a mechanism are clearer than the desktop's coach panel, because the Git output, the animation and the one-sentence explanation are the only things on the screen. Those are the rejected push (the commit flies to the tip and is knocked back, under Git's real `! [rejected]`), the conflict, blame, force-push, reflog and CI. On the desktop the same sentence competes with the whole table.

The routine ops pay the same price, and they earn nothing after the first time. A game is **about 105 screens over 9.3 rounds**, not counting about 26 returns to the hub: 400 simulated games, competent player. Of those:

| Per game | Screens | What they show |
|---|---|---|
| Round ceremony: O-Incident, O-YourTurn, O-TurnSummary, O-BotTurn | 36 | Four screens every round before or after anything happens |
| Your routine ops: I-Stage, O-Staged, I-Commit, O-Committed, O-Pushed, I-Pull, O-Pulled | about 40 | Each op is a question screen plus a consequence screen |
| Bot steps | 21 | 2.5 per bot turn, auto-advancing |
| O-Behind | 4.4 | In almost every other round |
| The moments: rejected, conflict, blame, force, reflog, CI | about 4 | The screens the format exists for |

Adding a card to your mat takes three taps (the card, git add, confirm on I-Stage) and a fourth screen (O-Staged). **Recommendation for the spec:** show one event per screen the first time each event happens in a game (and throughout the guided game). After that, routine events play their animation in the hub and leave a one-line receipt, and only the moments keep a screen. At a conservative count that brings a game to about 55 screens.

### Screens people will tap through (candidates to merge or drop)

These are predictions from what each screen adds; `playtest.js` counts consequence screens left in under 0.8 s as "tapped through".

- **O-Staged** repeats what I-Stage showed a second earlier. Drop it; the mat in the hub already shows the card arriving.
- **I-Stage** confirms a choice the hub already previews on the button ("Put 2 cards (+12) on your mat"). Fold its bug warning into that line and make git add act directly. Undo already covers a mistake.
- **O-Incident + O-YourTurn** are two taps to start every round. Merge them into one round opener: the incident, the two cards drawn, the ops, and at the tip or behind.
- **O-TurnSummary + O-BotTurn** are two screens between your last op and the bot's first. Merge them: your receipt, then "bot's turn" on one screen.
- **O-Pushed and O-Committed** are worth a screen the first time. By game two the Git line and the flying card are the same every time.

### Is the bot's turn watched or skipped?

It costs time but no taps: 2.5 steps per turn at 1.2 s each plus a 1 s intro is **about 4 s per bot turn, about 35 s per game**. Over 21,186 bot steps, 55% were remote ops worth watching (push 21.7%, rebase 16.5%, pull 8.6%, blame 6.3%, tag 1.4%, force 0.1%). The other 45% were "It staged a card." and "It committed what was on its mat." (commit 22.3%, stage 23.2%), which can't show anything because the bot's cards are hidden. Prediction: skip-bot presses cluster in turns that are only stage and commit. Recommendation: fold stage and commit into one step ("the bot is building a commit") and keep one screen per remote op. `playtest.js` records skip presses and how each bot step was left.

### Does O-Behind still help in game three?

Structurally it is redundant from game one: O-YourTurn says "You are 1 behind: a push would be rejected. Pull first." two screens after O-Behind says "You are 1 behind. Pull before you push." It shows 4.4 times a game. Prediction: it is read in game one (the guided game depends on it; the pull lesson lands in 99.2% of seeds) and tapped through by game three. Recommendation: keep it in the guided game and the first ordinary game, then let O-YourTurn carry the fact. `playtest.js` records O-Behind reading time by game number, for exactly this question.

### Rules the screens made awkward (rule findings, not UI findings)

1. **A plain pull with nothing local is a fast-forward, and still costs a merge token.** Writing Git's real output made this visible: O-Pulled prints `Fast-forward` and then says "The plain pull cost 1 op and a merge token". No merge commit exists in Git, so there is no messy history to penalise. It is not an edge case: **58% of the player's pulls** have nothing local (1,611 pulls in 400 games). A scratch-engine experiment over 2,000 games that makes the fast-forward free: merge tokens fall from 3.6 to 2.4 per game, games shorten from 9.3 to 8.8 rounds, the competent player's edge over the bot drops from 2.6:1 to 2.3:1, and `pull --rebase` with nothing local becomes strictly worse than a plain pull, which is also what Git says. **Proposed rule change** (not made here; it needs a tabletop playtest and a `rules:` change to base-rules.md and deck.json): *a merge token is taken only when the pull merges your unpushed commits.*
2. **Hands grow by about one card a round, from 5.7 in round 1 to 16.6 in round 11.** You draw 2 and play about 1. The base rules have no hand limit. On a phone, 13+ cards forced a second, smaller card size just to keep 44 px of each card tappable. It is also a lot of reading at a table. Worth a playtest question: a hand limit of 10 (discard at the end of your turn), or draw 1 when you hold 8 or more.
3. **The charter's key moment almost never happens against this bot.** In 2,000 games a force-push happened 0.028 times per game (1 game in 36) and a reflog 0.013 (1 in 77). The charter calls the `push --force` / `reflog` moment part of the core loop that "must work". The bot's force condition (behind by 2+ with a 4+ line commit of yours ahead, holding the card and a commit to push) is narrow, and the 3 force cards among the 75 in this prototype's deck rarely reach a hand at the right time. The player hits the same wall. For the 2-player online game, this needs either more force cards or a looser bot, or the moment is decorative.
4. **Vocabulary.** The spec's events (`RoundStarted`, `TurnStarted`) and the screens say *round* and *turn*, which [conventions.md](../../docs/conventions.md) §5 forbids. The prototype kept the spec's words because the vs-bot game is the tabletop game, where rounds and turns are real. The production spec should decide: rename to `DayStarted` / `PackStarted` to match the online model, or add *round* and *turn* to the vocabulary for the tabletop and hotseat modes.
5. **File colors collide with player colors.** `auth.js` is the same teal as "you", and `api.py` the same violet as "bot", as spec §4 asks ("from the deck's file palette family"). In the builder's play, an `api.py` card in your own hand read at a glance as the bot's. Player colors should come from outside the file palette.
6. **The lazy-message house rule barely survives a phone.** With good messages offered as one-tap suggestions, nobody types "wip" by accident. It becomes a deliberate self-penalty with no upside. Either give it an upside (a lazy commit is one op cheaper?) or leave it to the table.

### Screen and engine findings for the production client

- **Events must be per viewer.** The engine writes events as the player sees them: the bot's staged cards, drawn cards and hidden bugs appear only as counts. The bot's public reasoning also had to be stripped: the desktop copy "it staged its biggest clean card" leaked that the card was clean. The production day log needs the same per-viewer projection before the client maps it.
- **The spec's event payloads needed more** to print Git's output and animate from the right place: `from`/`to` hashes on `PushAccepted`, `Pulled` and `Forced`; `hadLocal` on `Pulled` (merge or fast-forward); `roll` on `PushAccepted`/`PushRejected`; `by` on `CIRan` (tag or deadline); `affordable` on `ConflictDetected`; an `Undone` event. They are listed in the spec's §2 now.
- **The frame must draw the state of the screen being shown**, not the latest state. One apply can span a turn change, so the latest state would show the next round's number and the bot's ops on your O-Pushed.
- **O-Behind has to be carried to the end of the bot's turn.** The tip moves mid-turn, but the lesson belongs just before your turn.
- **Cards crossing into a scrolling strip must fly on a layer above it**, or the strip clips them. All motion is transform-only (FLIP), so nothing jumps.
- **The hub is the crowded screen.** At 375 × 812 with a two-row hand and the guide bubble, "your branch" scrolls under the hand; at 740 tall it is worse. Merging the round-ceremony screens doesn't help here; the hub needs a denser `main` strip or a collapsible branch area.
- **The BUG tag must sit where overlapping cards can't cover it** (top left). Otherwise a bug in the middle of the hand is invisible.

### The mobile check (step 8)

This was done in the built-in browser at the mobile preset (375 × 812) and at 360 × 740, light and dark. Full games were audited screen by screen: 131 screens in one game, 129 in a guided game. On every screen there is no sideways page scroll, every tap target is at least 44 px (counting only the visible slice of an overlapped card), and every answer button sits in the bottom half. One guided turn was played with real taps. Safe areas come from `env(safe-area-inset-*)` with `viewport-fit=cover`; the pane can't emulate a notch, so that part is unverified on a device. `prefers-reduced-motion` switches every animation and transition off; the pane can't emulate it either, so that too is unverified.
