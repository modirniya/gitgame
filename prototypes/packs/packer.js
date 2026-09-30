// How a sensible player writes a day's pack: from the state they last fetched, an ordered list of up to 4 ops.
// It is the mobile bot's plan() turned from "the next op" into "the whole day", because a pack is written in one go
// and cannot react to what happens while it is processed. The one new idea is the defensive pull: a pull costs
// nothing when you are already up to date, so writing `pull` before `push` is insurance against whoever sends
// between your fetch and your pack — the question is whether that insurance makes sending early safe.
import { behindBy, conflictsFor, commitsOnMain, hasCmd, lines, hasBug, isLiveBug, opsFor, scores, RELEASE_AT } from './remote.js';

export function writePack(s, id, { defensive = true, fallback = false } = {}) {
  const p = s.players[id], others = s.ids.filter(x => x !== id), sc = scores(s);
  const behind = behindBy(s, id), cmds = s.incident !== 'sodown';
  let budget = opsFor(s); const ops = [];
  const add = (o, cost) => { if (ops.length < 4 && cost <= budget) { ops.push(o); budget -= cost; return true; } return false; };

  // Catching up: the strategy is declared on the op, because nobody will be there to answer a conflict prompt.
  const pull = () => {
    const conf = conflictsFor(s, id);
    let strategy = 'theirs';
    if (conf.length) { const m = conf[0].mine, t = conf[0].theirs; strategy = hasBug(m) ? 'theirs' : lines(m) >= lines(t) ? 'ours' : 'theirs'; }
    const rebase = behind && budget >= 3 && p.merge >= 1;
    return { o: { op: 'pull', rebase, strategy }, cost: behind ? (rebase ? 2 : 1) : 0 };
  };
  const willPush = p.local.length > 0;
  // A push, and with `fallback` a pull behind it: free if the push landed, and after a rejection it catches you up
  // for tomorrow — worth writing only if a rejected push leaves its op unspent (playtest question 2's refund).
  const push = () => { const ok = add({ op: 'push' }, 1); if (ok && fallback) add(pull().o, 0); return ok; };

  // 1. Release: tag when ahead (after pushing what is ready — tagging first would throw those lines away).
  if (commitsOnMain(s) >= RELEASE_AT(s.ids.length) && sc[id] >= Math.max(...others.map(o => sc[o]))) {
    if (willPush) { if (behind || defensive) { const x = pull(); add(x.o, x.cost); } push(); }
    add({ op: 'tag' }, 1);
    return ops;
  }
  // 2. Force-push when the commits ahead of you are big and someone else's; a reflog may bring them back.
  const ahead = s.main.slice(p.ptr);
  if (cmds && willPush && behind >= 2 && hasCmd(p, 'push --force') && ahead.some(c => c.author !== id && !c.revertOf && lines(c) >= 4)) add({ op: 'force' }, 1);
  // 3. Ship what is ready: pull if behind (or, defensively, always: it is free when nothing moved), then push.
  else if (willPush) { if (behind || defensive) { const x = pull(); add(x.o, x.cost); } push(); }
  else if (behind && budget >= 3) { const x = pull(); add(x.o, x.cost); }
  // 4. Blame the biggest face-down commit of someone else's.
  const target = s.main.filter(c => !c.init && !c.revertOf && c.author !== id && !c.flipped && !c.overwritten).sort((a, z) => lines(z) - lines(a))[0];
  if (cmds && hasCmd(p, 'git blame') && target && lines(target) >= 5) add({ op: 'blame', target: target.id }, 1);
  // 5. Revert an own flipped bug, from the tip.
  const own = s.main.find(c => c.author === id && !c.revertOf && c.flipped && isLiveBug(c));
  if (cmds && own && hasCmd(p, 'revert') && !behind) add({ op: 'revert', target: own.id }, 1);
  // 6. Build the next commit: the biggest clean cards, two if the budget allows add + commit + push. With one op
  //    left, staging alone still helps: the commit goes out tomorrow.
  const clean = p.hand.filter(c => !c.cmd && !c.bug).sort((a, z) => z.lines - a.lines);
  const bugs = p.hand.filter(c => !c.cmd && c.bug).sort((a, z) => a.lines - z.lines);
  const pick = clean.length ? clean.slice(0, budget >= 3 && clean.length >= 2 ? 2 : 1) : bugs.slice(0, 1);
  //    Cards already on the mat are committed first.
  const committed = p.staged.length ? add({ op: 'commit' }, 1)
    : pick.length && add({ op: 'add', cards: pick.map(c => c.id) }, 1) && add({ op: 'commit' }, 1);
  // a commit made this morning can go out tonight, if a free pull and a push still fit
  if (committed && !willPush && budget >= 1) { if (defensive && ops.length < 3) add(pull().o, 0); push(); }
  // 7. Traps are free: arm a reflog whenever one is in hand and none is armed.
  if (!p.armed && hasCmd(p, 'reflog')) add({ op: 'arm' }, 0);
  return ops;
}
