// The rules of the two-player game against the bot, as one pure function: apply(state, action) → { state, events }.
// It never mutates its input, never reads the clock and never touches the DOM, so a game is reproducible from its
// seed and its action list. The UI never reads state to decide what to show; it maps these events to screens —
// the same shape as the online remote's day log (docs/design/round-resolution.md), where packs are the actions.
// Events are written as the player sees them: nothing in an event reveals the bot's hand or its hidden bugs.
// Ported from prototypes/play-vs-bot/index.html; the rules are the same, the shape is new.

export const FILES = ['auth.js', 'api.py', 'styles.css', 'Dockerfile', 'README.md'];
export const CMD_COST = { 'git blame': 1, revert: 1, 'push --force': 1, reflog: 0 };
export const INCIDENTS = ['sodown', 'standup', 'flaky', 'hackathon', 'quiet', 'quiet2'];
export const RELEASE_AT = 10, MAX_ROUNDS = 12, BUG_PENALTY = 3, PRODUCTION_DOWN_AT = 4;
export const LAZY_MESSAGES = ['fix', 'wip', 'asdf']; // base rules, house rule: these commit messages draw a bug
export const OTHER = { you: 'bot', bot: 'you' };

// ---------- helpers other modules read (the bot, the hub, the tests) ----------
export const lines = c => c.cards.reduce((a, x) => a + x.lines, 0);
export const hasBug = c => !!c.lazy || c.cards.some(x => x.bug);
export const isLiveBug = c => !c.overwritten && !c.reverted && hasBug(c);
export const filesOf = c => new Set(c.cards.map(x => x.file));
export const commitsOnMain = s => s.main.length - 1;
export const behindBy = (s, id) => s.main.length - s.players[id].ptr;
export const hasCmd = (p, n) => p.hand.some(c => c.cmd === n);
export const noCommands = s => s.incident === 'sodown';
export const blameTargets = s => s.main.filter(c => !c.init && !c.revertOf && !c.flipped && !c.overwritten);
export const revertTargets = s => s.main.filter(c => !c.init && !c.revertOf && c.flipped && isLiveBug(c));
export const conflictsFor = (s, id) => {
  const p = s.players[id];
  const incoming = s.main.slice(p.ptr).filter(c => !c.overwritten && !c.revertOf);
  const out = [];
  for (const mine of p.local) for (const theirs of incoming) {
    const shared = [...filesOf(mine)].filter(f => filesOf(theirs).has(f));
    if (shared.length) out.push({ mine: mine.id, theirs: theirs.id, shared });
  }
  return out;
};
const byId = (s, id) => s.main.find(c => c.id === id);

// mulberry32: small, fast, and good enough that a shuffle looks random; the state lives in the game so apply stays pure
function rand(s) {
  let t = (s.rng = (s.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
// Short hashes instead of "Y3": Git names commits by hash, and players read the log the way Git prints it.
// Derived from seed and counter, not from the shuffle's RNG, so adding a commit never changes the deck order.
function sha(s) {
  let h = (Math.imul(s.seed ^ 0x9e3779b9, 31) + Math.imul(s.nextId++, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0; h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0).toString(16).padStart(8, '0').slice(0, 7);
}

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

// ---------- game lifecycle ----------
export function createGame({ seed = 1, guided = false } = {}) {
  const s = {
    seed: seed >>> 0, guided, rng: seed >>> 0, nextId: 1, deck: [],
    main: [],
    round: 0, turn: 'you', ops: 0, incident: null, rolled: false, pending: null, over: false, released: null,
    players: {}, undo: [], turnOps: [], turnStartScore: null, behindShown: false,
  };
  s.main.push({ id: sha(s), init: true, author: null, cards: [], flipped: true, message: 'Initial commit' });
  s.deck = buildDeck(s);
  for (const id of ['you', 'bot']) s.players[id] = { hand: [], staged: [], local: [], ptr: 1, merge: 0, sin: 0, grudges: 0, blame: 0, fixes: 0 };
  for (let i = 0; i < 5; i++) { draw(s, 'you'); draw(s, 'bot'); }
  if (guided) {
    // The bot's first turn can't usually push (pull, add, commit spends the budget), so the "you are behind" lesson
    // would never happen. A commit ready in its local branch makes its first turn pull → push.
    const b = s.players.bot; const i = b.hand.findIndex(c => !c.cmd && !c.bug);
    if (i >= 0) b.local.push({ id: sha(s), author: 'bot', cards: b.hand.splice(i, 1), flipped: false, message: 'initial scaffolding' });
  }
  const events = [];
  startRound(s, events);
  return { state: s, events };
}
const draw = (s, id) => { const c = s.deck.shift(); if (c) s.players[id].hand.push(c); return c; };
const opsFor = s => s.incident === 'standup' ? 2 : s.incident === 'hackathon' ? 4 : 3;

function startRound(s, ev) {
  s.round++; s.rolled = false;
  s.incident = s.guided && s.round === 1 ? 'quiet' : INCIDENTS[Math.floor(rand(s) * INCIDENTS.length)]; // the guided first turn assumes 3 ops and no die
  ev.push({ type: 'RoundStarted', round: s.round, incident: s.incident });
  beginTurn(s, 'you', ev);
}
function beginTurn(s, id, ev) {
  s.turn = id;
  const drawn = [draw(s, id), draw(s, id)].filter(Boolean);
  s.ops = opsFor(s); s.undo = []; s.turnOps = []; s.turnStartScore = scores(s); s.behindShown = false;
  ev.push({ type: 'TurnStarted', player: id, ops: s.ops, drawn: id === 'you' ? drawn : drawn.length, behindBy: behindBy(s, id) });
}
function endTurn(s, ev) {
  const id = s.turn, was = s.turnStartScore, now = scores(s);
  ev.push({ type: 'TurnEnded', player: id, summary: s.turnOps, scoreDelta: { you: now.you.total - was.you.total, bot: now.bot.total - was.bot.total } });
  s.ops = 0; s.undo = []; s.turnOps = [];
  if (id === 'you') beginTurn(s, 'bot', ev);
  else if (s.round >= MAX_ROUNDS) release(s, ev); // the release date doesn't move: CI runs on whatever is on main
  else startRound(s, ev);
}
// The first time in a bot turn that the tip moves past you, say so: it is the one thing the player must not miss.
function tipMoved(s, id, ev) {
  if (id !== 'bot' || s.behindShown || !behindBy(s, 'you')) return;
  s.behindShown = true;
  ev.push({ type: 'YouAreBehind', behindBy: behindBy(s, 'you') });
}

// ---------- ops ----------
function need(ok, why) { if (!ok) throw new Error('illegal action: ' + why); }
function spend(s, n) { need(s.ops >= n, 'not enough ops'); s.ops -= n; }
function takeCmd(p, n) { const i = p.hand.findIndex(c => c.cmd === n); need(i >= 0, 'no ' + n + ' card'); return p.hand.splice(i, 1)[0]; }
const mine = (id, x, count) => id === 'you' ? x : count; // events carry the bot's private data only as a count

const OPS = {
  stage(s, id, a, ev) {
    const p = s.players[id];
    need(a.cards?.length, 'nothing selected');
    const cards = a.cards.map(k => p.hand.find(c => c.id === k));
    need(cards.every(c => c && !c.cmd), 'only commit cards can be staged');
    spend(s, 1);
    p.hand = p.hand.filter(c => !cards.includes(c)); p.staged.push(...cards);
    return { type: 'Staged', player: id, cards: mine(id, cards, cards.length) };
  },
  commit(s, id, a) {
    const p = s.players[id];
    need(p.staged.length, 'nothing staged');
    spend(s, 1);
    const message = String(a.message ?? '').trim();
    const c = { id: sha(s), author: id, cards: p.staged.splice(0), flipped: false, message, lazy: LAZY_MESSAGES.includes(message.toLowerCase()) };
    p.local.push(c);
    return { type: 'Committed', player: id, commit: c.id, message, lines: mine(id, lines(c), undefined), hasBug: mine(id, hasBug(c), undefined), lazy: mine(id, c.lazy, undefined) };
  },
  push(s, id, a, ev) {
    const p = s.players[id];
    need(p.local.length, 'nothing to push');
    spend(s, 1);
    const behind = behindBy(s, id);
    let roll;
    if (behind) return { type: 'PushRejected', player: id, reason: 'non-fast-forward', behindBy: behind, commits: p.local.map(c => c.id) };
    if (s.incident === 'flaky' && !s.rolled) {
      s.rolled = true; s.undo = []; // a die roll can't be taken back
      roll = 1 + Math.floor(rand(s) * 6);
      if (roll <= 2) return { type: 'PushRejected', player: id, reason: 'flaky', roll, behindBy: 0, commits: p.local.map(c => c.id) };
    }
    const ids = p.local.map(c => c.id), from = s.main[s.main.length - 1].id;
    s.main.push(...p.local); p.local = []; p.ptr = s.main.length;
    ev.push({ type: 'PushAccepted', player: id, commits: ids, from, mainSize: commitsOnMain(s), ...(roll && { roll }) });
    tipMoved(s, id, ev);
  },
  pull(s, id, a, ev) {
    const behind = behindBy(s, id), cost = a.rebase ? 2 : 1;
    need(behind > 0, 'Already up to date.');
    need(s.ops >= cost, 'not enough ops');
    const conflicts = conflictsFor(s, id);
    const detected = { type: 'ConflictDetected', player: id, rebase: !!a.rebase, conflicts, affordable: ['ours', 'theirs', ...(s.ops >= cost + 1 ? ['resolve'] : [])] };
    if (conflicts.length && !a.strategy) { s.pending = { rebase: !!a.rebase }; ev.push(detected); return; } // the player answers on I-Conflict
    if (conflicts.length) ev.push(detected); // the bot pre-declares its strategy, like -X ours on a pull online
    return pullWith(s, id, !!a.rebase, a.strategy, ev);
  },
  resolve(s, id, a, ev) {
    need(s.pending, 'no conflict to resolve');
    const { rebase } = s.pending; s.pending = null;
    return pullWith(s, id, rebase, a.strategy, ev);
  },
  blame(s, id, a) {
    const p = s.players[id], t = byId(s, a.target);
    need(!noCommands(s), 'no command cards this round');
    need(t && blameTargets(s).includes(t), 'not a face-down commit');
    takeCmd(p, 'git blame'); spend(s, 1); s.undo = []; // what's flipped stays flipped
    t.flipped = true;
    const wasBug = isLiveBug(t);
    if (wasBug) { s.players[t.author].blame += BUG_PENALTY; t.blamed = true; }
    return { type: 'Blamed', player: id, target: t.id, wasBug, author: t.author, penalty: wasBug ? BUG_PENALTY : 0 };
  },
  revert(s, id, a, ev) {
    const p = s.players[id], t = byId(s, a.target);
    need(!noCommands(s), 'no command cards this round');
    need(!behindBy(s, id), 'a revert is a commit you push: you must be at the tip'); // finding from play-vs-bot
    need(t && revertTargets(s).includes(t), 'not a flipped bug');
    takeCmd(p, 'revert'); spend(s, 1);
    t.reverted = true;
    const rv = { id: sha(s), author: id, cards: [], revertOf: t.id, flipped: true, message: `Revert "${t.message || t.id}"` };
    s.main.push(rv); p.ptr = s.main.length; p.fixes++;
    ev.push({ type: 'Reverted', player: id, target: t.id, revert: rv.id, author: t.author });
    tipMoved(s, id, ev);
  },
  force(s, id, a, ev) {
    const p = s.players[id];
    need(!noCommands(s), 'no command cards this round');
    need(behindBy(s, id) > 0, 'nothing ahead of you to erase');
    takeCmd(p, 'push --force'); spend(s, 1); s.undo = []; // it reveals whether the other side holds reflog
    const before = p.ptr, erased = s.main.slice(before), pushed = p.local.map(c => c.id), oldTip = s.main[s.main.length - 1].id;
    s.main = s.main.slice(0, before); s.main.push(...p.local); p.local = []; p.sin++;
    for (const q of Object.values(s.players)) q.ptr = Math.min(q.ptr, before); // every pointer is now at or before the rewrite
    p.ptr = s.main.length;
    // One reflog in a victim's hand restores everything of theirs that was erased, in order (play-vs-bot finding).
    const victims = [...new Set(erased.map(c => c.author))].filter(v => v && v !== id);
    const reflogged = victims.filter(v => hasCmd(s.players[v], 'reflog'));
    for (const v of reflogged) takeCmd(s.players[v], 'reflog');
    const returned = [], revived = [], restored = [];
    for (const c of erased) {
      const owner = s.players[c.author];
      if (reflogged.includes(c.author)) { s.main.push(c); owner.ptr = s.main.length; restored.push(c.id); }
      else if (c.revertOf) { const t = byId(s, c.revertOf); if (t) t.reverted = false; owner.fixes = Math.max(0, owner.fixes - 1); revived.push(c.revertOf); }
      else if (!c.overwritten) { owner.local.unshift(c); returned.push(c.id); }
    }
    ev.push({ type: 'Forced', player: id, erased: erased.map(c => c.id), pushed, returned, revived, sin: p.sin, from: before, oldTip, newTip: s.main[before - 1 + pushed.length].id });
    for (const v of reflogged) ev.push({ type: 'ReflogFired', victim: v, restored: erased.filter(c => c.author === v).map(c => c.id) });
    tipMoved(s, id, ev);
  },
  tag(s, id, a, ev) {
    need(commitsOnMain(s) >= RELEASE_AT, `main needs ${RELEASE_AT} commits`);
    spend(s, 1);
    ev.push({ type: 'Tagged', by: id });
    release(s, ev, id);
  },
  endTurn(s, id, a, ev) { need(!s.pending, 'answer the conflict first'); endTurn(s, ev); },
  undo(s, id, a, ev) {
    need(id === 'you' && s.undo.length, 'nothing to undo');
    const rest = s.undo.slice(0, -1), prev = JSON.parse(s.undo[s.undo.length - 1]);
    for (const k of Object.keys(s)) delete s[k];
    Object.assign(s, prev, { undo: rest });
    ev.push({ type: 'Undone' });
  },
};

function pullWith(s, id, rebase, strategy, ev) {
  const p = s.players[id], conflicts = conflictsFor(s, id), incoming = s.main.slice(p.ptr).map(c => c.id), from = s.main[p.ptr - 1].id;
  need(!conflicts.length || ['ours', 'theirs', 'resolve'].includes(strategy), 'pick a strategy');
  spend(s, (rebase ? 2 : 1) + (conflicts.length && strategy === 'resolve' ? 1 : 0));
  const crossedOut = [], discarded = [];
  let grudges = 0;
  for (const k of conflicts) {
    const m = p.local.find(c => c.id === k.mine), t = byId(s, k.theirs);
    if (!m || t.overwritten) continue;
    if (strategy === 'ours') { t.overwritten = true; t.flipped = true; p.grudges++; grudges++; crossedOut.push(t.id); }
    else if (strategy === 'theirs') { p.local = p.local.filter(c => c !== m); discarded.push(m.id); }
  }
  if (conflicts.length) ev.push({ type: 'ConflictResolved', player: id, strategy, crossedOut, discarded, grudges, extraOp: strategy === 'resolve' });
  p.ptr = s.main.length;
  if (!rebase) p.merge++;
  return { type: 'Pulled', player: id, rebase, mergeTokens: p.merge, incoming, from, to: s.main[s.main.length - 1].id, hadLocal: p.local.length > 0, ptr: p.ptr };
}

function release(s, ev, by = null) {
  s.over = true; s.pending = null;
  const flips = []; let bugs = 0;
  for (const c of s.main) {
    if (c.init || c.revertOf) continue;
    const wasFaceDown = !c.flipped; c.flipped = true;
    const counts = !c.overwritten && !c.reverted && hasBug(c);
    if (counts) { bugs++; if (!c.blamed) { c.blamed = true; s.players[c.author].blame += BUG_PENALTY; } }
    flips.push({ id: c.id, author: c.author, wasFaceDown, bug: hasBug(c), counts });
  }
  s.released = { bugs, down: bugs >= PRODUCTION_DOWN_AT };
  ev.push({ type: 'CIRan', by, flips, bugs, productionDown: s.released.down });
}

// ---------- the one entry point ----------
const UNDOABLE = ['stage', 'commit', 'push', 'pull', 'revert'];
export function apply(state, action) {
  need(!state.over, 'the game is over');
  need(OPS[action.type], 'unknown action ' + action.type);
  need(!state.pending || action.type === 'resolve', 'answer the conflict first');
  const s = structuredClone(state), id = s.turn, ev = [];
  if (id === 'you' && UNDOABLE.includes(action.type)) s.undo.push(JSON.stringify({ ...state, undo: [] }));
  const main = OPS[action.type](s, id, action, ev);
  if (main) ev.push(main);
  if (!['endTurn', 'undo'].includes(action.type) && s.turn === id && !s.over) {
    s.turnOps.push(...ev.filter(e => !['ConflictDetected', 'YouAreBehind'].includes(e.type)));
    if (!s.pending && s.ops <= 0) endTurn(s, ev); // unused ops are lost; with none left the turn is over
  }
  return { state: s, events: ev };
}

// While the game runs a face-down bug counts as clean — otherwise the live score would give hidden bugs away.
export function scores(s) {
  const out = {};
  for (const [id, p] of Object.entries(s.players)) {
    let ln = 0;
    for (const c of s.main) {
      if (c.init || c.revertOf || c.author !== id || c.overwritten || c.reverted || (c.flipped && hasBug(c))) continue;
      ln += lines(c);
    }
    out[id] = { lines: ln, fixes: p.fixes, blame: -p.blame, merge: -p.merge, grudge: -p.grudges, sin: -p.sin, total: ln + p.fixes - p.blame - p.merge - p.grudges - p.sin };
  }
  return out;
}
// Production down means the release failed and the least blame wins; otherwise the higher total wins.
export function winner(s) {
  const sc = scores(s), y = s.players.you, b = s.players.bot;
  if (s.released?.down) return y.blame < b.blame ? 'you' : y.blame > b.blame ? 'bot' : 'draw';
  return sc.you.total > sc.bot.total ? 'you' : sc.you.total < sc.bot.total ? 'bot' : 'draw';
}

// Every op the current player could take, with its cost and, when it can't be taken, why. The hub renders this
// list directly, so the reasons it shows are the engine's reasons, not a second copy of the rules in the UI.
export function legalActions(s) {
  if (s.over) return [];
  const id = s.turn, p = s.players[id], behind = behindBy(s, id), ops = s.ops;
  if (s.pending) {
    const base = s.pending.rebase ? 2 : 1;
    return ['ours', 'theirs', 'resolve'].map(strategy => {
      const cost = strategy === 'resolve' ? base + 1 : base;
      return { key: strategy, action: { type: 'resolve', strategy }, cost, enabled: ops >= cost, reason: ops >= cost ? null : 'no-ops' };
    });
  }
  const card = n => !hasCmd(p, n) ? 'no-card' : noCommands(s) ? 'sodown' : null;
  const opt = (key, action, cost, block, data = {}) => ({ key, action, cost, enabled: !block && ops >= cost, reason: block || (ops < cost ? 'no-ops' : null), data });
  const conflict = conflictsFor(s, id).length > 0;
  return [
    opt('stage', { type: 'stage' }, 1, p.hand.some(c => !c.cmd) ? null : 'no-commit-cards'),
    opt('commit', { type: 'commit' }, 1, p.staged.length ? null : 'mat-empty', { lines: p.staged.reduce((a, c) => a + c.lines, 0), bug: p.staged.some(c => c.bug) }),
    opt('push', { type: 'push' }, 1, p.local.length ? null : 'nothing-to-push', { behind, flaky: s.incident === 'flaky' && !s.rolled, commits: p.local.map(c => c.id) }),
    opt('pull', { type: 'pull', rebase: false }, 1, behind ? null : 'up-to-date', { behind, conflict }),
    opt('rebase', { type: 'pull', rebase: true }, 2, behind ? null : 'up-to-date', { behind, conflict }),
    opt('blame', { type: 'blame' }, 1, card('git blame') || (blameTargets(s).length ? null : 'no-face-down'), { targets: blameTargets(s).map(c => c.id) }),
    opt('revert', { type: 'revert' }, 1, card('revert') || (revertTargets(s).length ? null : 'no-flipped-bug') || (behind ? 'behind' : null), { targets: revertTargets(s).map(c => c.id) }),
    opt('force', { type: 'force' }, 1, card('push --force') || (behind ? null : 'nothing-ahead'), { behind, erase: s.main.slice(p.ptr).map(c => c.id) }),
    opt('tag', { type: 'tag' }, 1, commitsOnMain(s) >= RELEASE_AT ? null : 'too-early', { commits: commitsOnMain(s) }),
    { key: 'endTurn', action: { type: 'endTurn' }, cost: 0, enabled: true, reason: null, data: { ops } },
    { key: 'undo', action: { type: 'undo' }, cost: 0, enabled: id === 'you' && s.undo.length > 0, reason: 'nothing-to-undo', data: {} },
  ];
}
