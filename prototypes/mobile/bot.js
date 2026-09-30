// The bot: a readable heuristic, ported from play-vs-bot's plan(). plan(state, id) says what a sensible player
// would do next and why; the bot plays it, and the hint button shows it to the player. The reason is data
// ({ key, ...facts }) so copy.js can say it in the third person in the bot's bubble and in the second in a hint.
import { apply, scores, behindBy, conflictsFor, commitsOnMain, hasCmd, noCommands, lines, hasBug, isLiveBug, OTHER, RELEASE_AT } from './engine.js';
import { commitMessage } from './copy.js';

export function plan(s, id = 'bot') {
  const p = s.players[id], o = OTHER[id], behind = behindBy(s, id), ops = s.ops, sc = scores(s);
  const cmds = !noCommands(s);
  // Push first, tag second: a bot that tags while holding an unpushed commit throws its own lines away.
  if (p.local.length && !behind) return { action: { type: 'push' }, why: { key: 'push', commits: p.local.map(c => c.id) } };
  if (commitsOnMain(s) >= RELEASE_AT && sc[id].total >= sc[o].total) return { action: { type: 'tag' }, why: { key: 'tag', commits: commitsOnMain(s), mine: sc[id].total, theirs: sc[o].total } };
  if (cmds && p.local.length && behind >= 2 && hasCmd(p, 'push --force') && s.main.slice(p.ptr).some(c => c.author === o && lines(c) >= 4)) {
    return { action: { type: 'force' }, why: { key: 'force', behind } };
  }
  if (behind && (p.local.length || ops >= 2)) {
    const conf = conflictsFor(s, id);
    let strategy, conflict = null;
    if (conf.length) {
      const m = p.local.find(c => c.id === conf[0].mine), t = s.main.find(c => c.id === conf[0].theirs);
      const bug = hasBug(m);
      strategy = bug ? 'theirs' : ops >= 3 ? 'resolve' : lines(m) >= lines(t) ? 'ours' : 'theirs';
      conflict = { file: conf[0].shared[0], strategy, ownBug: bug };
    }
    const rebase = ops >= 3 && p.merge >= 1 && strategy !== 'resolve';
    return { action: { type: 'pull', rebase, ...(strategy && { strategy }) }, why: { key: rebase ? 'rebase' : 'pull', behind, merge: p.merge, conflict } };
  }
  const oppBig = s.main.filter(c => !c.init && !c.revertOf && c.author === o && !c.flipped && !c.overwritten).sort((a, z) => lines(z) - lines(a))[0];
  if (cmds && hasCmd(p, 'git blame') && oppBig && lines(oppBig) >= 5 && !p.staged.length) {
    return { action: { type: 'blame', target: oppBig.id }, why: { key: 'blame', target: oppBig.id, targetLines: lines(oppBig) } };
  }
  if (cmds && hasCmd(p, 'revert') && !behind) { // a revert is a commit that gets pushed, so only at the tip
    const own = s.main.find(c => c.author === id && !c.revertOf && c.flipped && isLiveBug(c));
    if (own) return { action: { type: 'revert', target: own.id }, why: { key: 'revert', target: own.id } };
  }
  if (p.staged.length) return { action: { type: 'commit', message: commitMessage(p.staged) }, why: { key: 'commit', cards: p.staged.map(c => c.id), lines: p.staged.reduce((a, c) => a + c.lines, 0) } };
  const clean = p.hand.filter(c => !c.cmd && !c.bug).sort((a, z) => z.lines - a.lines);
  const bugs = p.hand.filter(c => !c.cmd && c.bug).sort((a, z) => a.lines - z.lines);
  if (clean.length) {
    const pick = ops >= 3 && clean.length >= 2 ? clean.slice(0, 2) : [clean[0]];
    return { action: { type: 'stage', cards: pick.map(c => c.id) }, why: { key: pick.length > 1 ? 'stageTwo' : 'stageOne', cards: pick.map(c => c.id), lines: pick.reduce((a, c) => a + c.lines, 0) } };
  }
  if (bugs.length) return { action: { type: 'stage', cards: [bugs[0].id] }, why: { key: 'stageBug', cards: [bugs[0].id] } };
  return { action: { type: 'endTurn' }, why: { key: 'end', ops } };
}

// Events that end or start a turn stay outside BotActed: the router shows them as their own screens.
export const TRANSITIONS = new Set(['TurnEnded', 'RoundStarted', 'TurnStarted', 'YouAreBehind', 'CIRan']);

// The bubble is public: strip what only the bot can see — which cards, how many lines, whether one is a bug.
function publicWhy(why) {
  const { cards, lines: _, ...shown } = why;
  if (shown.key === 'stageBug') shown.key = 'stageOne';
  if (shown.conflict) { const { ownBug, ...c } = shown.conflict; shown.conflict = c; }
  if (cards) shown.count = cards.length;
  return shown;
}

// One bot op: plan it, apply it, and wrap what it did in a BotActed event carrying its reasoning.
export function botStep(s) {
  const { action, why } = plan(s, 'bot');
  const r = apply(s, action);
  const own = r.events.filter(e => !TRANSITIONS.has(e.type)), rest = r.events.filter(e => TRANSITIONS.has(e.type));
  const shown = publicWhy(why);
  return { state: r.state, action, events: [{ type: 'BotActed', op: shown.key, why: shown, events: own }, ...rest] };
}
