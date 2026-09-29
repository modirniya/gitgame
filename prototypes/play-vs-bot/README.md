# play-vs-bot

*Status: Done · Last verified: 2026-09-29*

**Question:** can one person understand the game by playing it against a bot, with a guide and hints?

**Run:** open `index.html` in a browser. **Test:** `node smoke-test.js` (auto-plays 800 games through the engine with a stubbed DOM, checks the guided first game and the reflog rule).

Single-file desktop page. The engine is the tabletop rules for two players (add, commit, push, pull, rebase, conflicts with ours/theirs/resolve, blame, revert, force-push, reflog, incidents, tag/CI, scoring). The bot is a readable heuristic (`plan()`), also used by the hint button. Every action button explains what it will do in the current situation; a coach panel explains every consequence; a guided first game highlights what to tap; undo covers the player's own ops except blame and die rolls; the live score treats face-down bugs as clean so it never leaks.

## Findings

- **A commit takes about two turns** once the opponent is active (pull + push, then add + commit). Three ops per turn is the right tension, and it means the release target must scale with player count: 10 works for two.
- **`reflog` needs a stated scope.** One card restores all of the victim's erased commits. The deck text should say so.
- **`revert` must require being at the tip** — it is a commit that gets pushed. The deck text lets a behind player do it.
- **The bot's first turn usually cannot push** (pull, add, commit uses the budget), so a guided game must give the bot a commit head-start or the "you are behind" lesson never happens.
- **Scoring must not leak hidden information.** Any live score has to count a face-down bug as clean.
- Bot strength: a competent player wins about 3:1, a random one loses about 20:1. Good for teaching; too weak for a veteran.
