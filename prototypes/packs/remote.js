// The online rules as a simulation: days, packs and a remote that resolves each pack the moment it arrives
// (docs/design/round-resolution.md). Copied from prototypes/mobile/engine.js where the rules are the same (deck,
// scoring, conflicts, force-push) and rewritten where they differ: no turns, every player sends one pack of up to
// 4 ops per day, the remote runs a pack until its 3-op budget is spent, pull and push are free when there is
// nothing to do, an op that fails still costs its ops, and a reflog is a trap armed in advance.
// `rules` carries the variants the playtest questions ask about, so one run can compare them.

export const FILES = ['auth.js', 'api.py', 'styles.css', 'Dockerfile', 'README.md'];
export const INCIDENTS = ['sodown', 'standup', 'flaky', 'hackathon', 'quiet', 'quiet2'];
export const DAYS = 12, BUG_PENALTY = 3, PRODUCTION_DOWN_AT = 4, PACK_MAX = 4;
export const RELEASE_AT = n => n <= 2 ? 10 : n === 3 ? 12 : 15; // base-rules.md, setup

export const lines = c => c.cards.reduce((a, x) => a + x.lines, 0);
export const hasBug = c => c.cards.some(x => x.bug);
export const isLiveBug = c => !c.overwritten && !c.reverted && hasBug(c);
const filesOf = c => new Set(c.cards.map(x => x.file));
export const commitsOnMain = s => s.main.length - 1;
export const behindBy = (s, id) => s.main.length - s.players[id].ptr;
export const hasCmd = (p, n) => p.hand.some(c => c.cmd === n);
export const opsFor = s => s.incident === 'standup' ? 2 : s.incident === 'hackathon' ? 4 : 3;
export function conflictsFor(s, id) {
  const p = s.players[id], incoming = s.main.slice(p.ptr).filter(c => !c.overwritten && !c.revertOf), out = [];
  for (const mine of p.local) for (const theirs of incoming) if ([...filesOf(mine)].some(f => filesOf(theirs).has(f))) out.push({ mine, theirs });
  return out;
}

function rand(s) {
  let t = (s.rng = (s.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const random = rand;

function buildDeck(s) {
  const d = []; let n = 0;
  for (const file of FILES) {
    let seen3 = false;
    for (const ln of [1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 7, 8]) {
      let bug = ln === 6 || (ln === 3 && !seen3); if (ln === 3) seen3 = true;
      if (ln === 8 && (file === 'auth.js' || file === 'api.py')) bug = true;
      d.push({ id: 'k' + n++, file, lines: ln, bug });
    }
  }
  for (const [cmd, count] of [['git blame', 5], ['revert', 4], ['push --force', 3], ['reflog', 3]]) for (let i = 0; i < count; i++) d.push({ id: 'k' + n++, cmd });
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(rand(s) * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}

export function createGame({ seed = 1, players = 2, rules = {} } = {}) {
  const ids = Array.from({ length: players }, (_, i) => 'p' + i);
  const s = { seed, rng: seed >>> 0, nextId: 1, rules, ids, main: [{ id: 'c0', init: true, cards: [] }], day: 0, incident: null, rolled: false, over: false, released: null, players: {}, log: [] };
  s.deck = buildDeck(s);
  for (const id of ids) s.players[id] = { hand: [], staged: [], local: [], ptr: 1, merge: 0, sin: 0, grudges: 0, blame: 0, fixes: 0, armed: false };
  for (let i = 0; i < 5; i++) for (const id of ids) draw(s, id);
  return s;
}
const draw = (s, id) => { const c = s.deck.shift(); if (c) s.players[id].hand.push(c); };

// Day start: the incident flips, everyone draws 2. Mutates: the simulation clones only where it needs a snapshot.
export function startDay(s) {
  s.day++; s.rolled = false;
  s.incident = INCIDENTS[Math.floor(rand(s) * INCIDENTS.length)];
  for (const id of s.ids) { draw(s, id); draw(s, id); }
}
export function endDay(s) { if (!s.over && s.day >= DAYS) release(s, null); }

// ---------- one op at processing time: { cost, run } where run() returns the outcome ----------
const take = (p, n) => p.hand.splice(p.hand.findIndex(c => c.cmd === n), 1)[0];
const fail = (why, extra = {}) => ({ ok: false, why, ...extra });
function op(s, id, o) {
  const p = s.players[id], behind = behindBy(s, id), cmdsOff = s.incident === 'sodown';
  const card = n => cmdsOff ? 'Stack Overflow is down' : hasCmd(p, n) ? null : 'no card';
  switch (o.op) {
    case 'add': return { cost: 1, run: () => {
      const cards = o.cards.map(k => p.hand.find(c => c.id === k)).filter(Boolean);
      if (!cards.length) return fail('nothing to add');
      p.hand = p.hand.filter(c => !cards.includes(c)); p.staged.push(...cards); return { ok: true };
    } };
    case 'commit': return { cost: 1, run: () => {
      if (!p.staged.length) return fail('nothing to commit');
      p.local.push({ id: 'x' + s.nextId++, author: id, cards: p.staged.splice(0), flipped: false }); return { ok: true };
    } };
    case 'push': return { cost: p.local.length ? 1 : 0, run: () => {
      if (!p.local.length) return { ok: true, noop: 'Everything up-to-date' };
      if (behind) return fail('! [rejected] non-fast-forward', { rejected: true });
      if (s.incident === 'flaky' && !s.rolled) { s.rolled = true; if (1 + Math.floor(rand(s) * 6) <= 2) return fail('CI failed (flaky)', { rejected: true }); }
      const n = p.local.length; s.main.push(...p.local); p.local = []; p.ptr = s.main.length; return { ok: true, pushed: n };
    } };
    case 'pull': {
      const conflicts = conflictsFor(s, id), strategy = o.strategy || 'theirs'; // unspecified = theirs (round-resolution §3)
      const cost = !behind ? 0 : (o.rebase ? 2 : 1) + (conflicts.length && strategy === 'resolve' ? 1 : 0);
      return { cost, run: () => {
        if (!behind) return { ok: true, noop: 'Already up to date.' };
        for (const { mine, theirs } of conflicts) {
          if (theirs.overwritten || !p.local.includes(mine)) continue;
          if (strategy === 'ours') { theirs.overwritten = true; theirs.flipped = true; p.grudges++; }
          else if (strategy === 'theirs') p.local = p.local.filter(c => c !== mine);
        }
        const hadLocal = p.local.length > 0;
        p.ptr = s.main.length;
        if (!o.rebase && (hadLocal || !s.rules.freeFastForward)) p.merge++;
        return { ok: true, conflicts: conflicts.length };
      } };
    }
    case 'blame': return { cost: 1, run: () => {
      const t = s.main.find(c => c.id === o.target);
      if (card('git blame')) return fail(card('git blame'));
      if (!t || t.flipped || t.overwritten) return fail('already face-up');
      take(p, 'git blame'); t.flipped = true;
      if (isLiveBug(t)) { s.players[t.author].blame += BUG_PENALTY; t.blamed = true; return { ok: true, hit: true }; }
      return { ok: true, hit: false };
    } };
    case 'revert': return { cost: 1, run: () => {
      const t = s.main.find(c => c.id === o.target);
      if (card('revert')) return fail(card('revert'));
      if (behind) return fail('! [rejected] non-fast-forward', { rejected: true });
      if (!t || !t.flipped || !isLiveBug(t)) return fail('not a flipped bug');
      take(p, 'revert'); t.reverted = true;
      s.main.push({ id: 'x' + s.nextId++, author: id, cards: [], revertOf: t.id, flipped: true }); p.ptr = s.main.length; p.fixes++;
      return { ok: true };
    } };
    case 'force': return { cost: 1, run: () => {
      if (card('push --force')) return fail(card('push --force'));
      if (!behind) return fail('nothing ahead to overwrite');
      take(p, 'push --force');
      const at = p.ptr, erased = s.main.slice(at);
      s.main = s.main.slice(0, at); s.main.push(...p.local); p.local = []; p.sin++;
      for (const id2 of s.ids) s.players[id2].ptr = Math.min(s.players[id2].ptr, at);
      p.ptr = s.main.length;
      // armed reflogs fire now, during someone else's pack: one trap restores everything of its owner's
      const fired = new Set([...new Set(erased.map(c => c.author))].filter(v => v !== id && s.players[v].armed));
      for (const v of fired) s.players[v].armed = false;
      for (const c of erased) {
        const owner = s.players[c.author];
        if (fired.has(c.author)) { s.main.push(c); owner.ptr = s.main.length; }
        else if (c.revertOf) { const t = s.main.find(x => x.id === c.revertOf); if (t) t.reverted = false; owner.fixes = Math.max(0, owner.fixes - 1); }
        else if (!c.overwritten) owner.local.unshift(c);
      }
      return { ok: true, erased: erased.length, reflogs: fired.size };
    } };
    case 'arm': return { cost: 0, run: () => {
      if (p.armed || !hasCmd(p, 'reflog')) return fail('no reflog to arm');
      take(p, 'reflog'); p.armed = true; return { ok: true };
    } };
    case 'tag': return { cost: 1, run: () => {
      if (commitsOnMain(s) < RELEASE_AT(s.ids.length)) return fail('main is not ready');
      release(s, id); return { ok: true };
    } };
  }
  throw new Error('unknown op ' + o.op);
}

// The remote receives one pack: it runs the ops in order until the budget is spent. A failed op still costs its
// ops — unless rules.refundRejectedPush and the failure was a rejection (playtest question 2's alternative).
export function receive(s, id, pack, meta = {}) {
  let budget = opsFor(s);
  const entry = { day: s.day, player: id, ...meta, ops: [] };
  for (const o of pack.slice(0, PACK_MAX)) {
    if (s.over) break;
    const { cost, run } = op(s, id, o);
    if (cost > budget) { entry.ops.push({ op: o.op, skipped: 'budget' }); break; }
    const r = run();
    const spent = !r.ok && r.rejected && s.rules.refundRejectedPush ? 0 : cost;
    budget -= spent;
    entry.ops.push({ op: o.op, spent, ...r });
  }
  s.log.push(entry);
  return entry;
}

function release(s, by) {
  s.over = true; let bugs = 0;
  for (const c of s.main) {
    if (c.init || c.revertOf) continue; c.flipped = true;
    if (!c.overwritten && !c.reverted && hasBug(c)) { bugs++; if (!c.blamed) { c.blamed = true; s.players[c.author].blame += BUG_PENALTY; } }
  }
  s.released = { by, bugs, down: bugs >= PRODUCTION_DOWN_AT, day: s.day };
}

// While the game runs a face-down bug counts as clean, so a live score never gives a hidden bug away.
export function scores(s) {
  const out = {};
  for (const id of s.ids) {
    const p = s.players[id]; let ln = 0;
    for (const c of s.main) if (!c.init && !c.revertOf && c.author === id && !c.overwritten && !c.reverted && !(c.flipped && hasBug(c))) ln += lines(c);
    out[id] = ln + p.fixes - p.blame - p.merge - p.grudges - p.sin;
  }
  return out;
}
// Production down: least blame wins. Otherwise the highest total. Ties share the win.
export function winners(s) {
  const sc = scores(s), key = s.released?.down ? id => -s.players[id].blame : id => sc[id];
  const best = Math.max(...s.ids.map(key));
  return s.ids.filter(id => key(id) === best);
}
