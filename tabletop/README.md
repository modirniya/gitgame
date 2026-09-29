# Tabletop: print-and-play

*Status: Draft · Last verified: 2026-09-29*

The paper version of the game, for the Phase 0 playtest. Download [print-and-play.pdf](print-and-play.pdf), print it, cut it, play.

## Printing

- **US Letter, single-sided, actual size** (no "fit to page" scaling — the cards are poker size, 2.5 × 3.5 in).
- Use thick paper or card stock, or put the cut cards in sleeves with opaque backs. **Face-down cards must not be readable through the paper**, or the bug bluff doesn't work.
- Pages: cover with setup, turn reference, card sheets (9 per page), token sheet. Print the reference page once per player if you can.
- No card backs are printed. All draw-deck cards share a blank back by design, so a bug is indistinguishable from a clean card once it's face down.

## What you need besides the printout

- Something to mark pointers if you don't cut the token sheet: coins, meeples, paper clips.
- A six-sided die (for the Flaky CI incident).
- A pen, to cross out overwritten commits.

## Rebuilding the PDF

The PDF is generated. **Never edit it by hand.** Change [`rules/deck.json`](../rules/deck.json), then:

```bash
python3 -m venv .venv && .venv/bin/pip install reportlab   # once
.venv/bin/python tabletop/build.py
```

Commit the JSON and the regenerated PDF together, with a `rules:` commit type. Card text and the rules doc ([docs/design/base-rules.md](../docs/design/base-rules.md)) must never disagree; if you change one, check the other.

## After a game

Write a short report in `docs/design/playtests/YYYY-MM-DD-<who>.md` (status *Archived*): players, how long it took, what was tense, what was boring, where the rules were unclear, who won and why. That is the whole point of this folder.
