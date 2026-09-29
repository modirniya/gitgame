// Smoke test for the mobile prototype: `node smoke-test.js`. Plays games through apply() only — no DOM — and
// checks the invariants the screens rely on. Exits non-zero on any failure, so "green" means exit code 0.
import { createGame, apply, legalActions, behindBy, winner } from './engine.js';
import { plan, botStep } from './bot.js';
import { REASON } from './copy.js';
import { screensFor } from './router.js';
import { SCREENS } from './screens.js';

const failures = [];
const fail = msg => { if (failures.length < 10) console.error('FAIL', msg); failures.push(msg); };
const check = (ok, msg) => { if (!ok) fail(msg); };
function testRng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (r, xs) => xs[Math.floor(r() * xs.length)];

// A player who takes any enabled op, sometimes undoes, and sometimes writes a lazy commit message.
function randomAction(s, r) {
  // the hub greys out what legalActions disables; the engine must refuse exactly those
  for (const o of legalActions(s)) if (!o.enabled && ['commit', 'push', 'pull', 'rebase', 'force', 'tag', 'undo'].includes(o.key)) {
    let threw = false; try { apply(s, o.action); } catch { threw = true; }
    check(threw, `legalActions disabled ${o.key} (${o.reason}) but apply accepted it`);
  }
  const opts = legalActions(s).filter(o => o.enabled && o.key !== 'endTurn' && (o.key !== 'undo' || r() < 0.1));
  if (!s.pending && (!opts.length || r() < 0.03)) return { type: 'endTurn' };
  const o = pick(r, opts), p = s.players[s.turn];
  if (o.key === 'stage') { const cc = p.hand.filter(c => !c.cmd); return { type: 'stage', cards: cc.slice(0, 1 + Math.floor(r() * 2)).map(c => c.id) }; }
  if (o.key === 'commit') return { type: 'commit', message: r() < 0.15 ? 'wip' : 'feat: something real' };
  if (o.key === 'blame' || o.key === 'revert') return { ...o.action, target: pick(r, o.data.targets) };
  return o.action;
}

// Plays one game to the end. `policy(state)` chooses the player's actions; the bot plays through botStep unless
// `both` is set, in which case the policy plays both sides. Returns the action list and the event log.
function play(seed, policy, { guided = false, both = false, onApply } = {}) {
  let { state, events } = createGame({ seed, guided });
  const log = [...events], actions = [];
  let guard = 0;
  while (!state.over) {
    if (++guard > 5000) throw new Error('game did not finish, seed ' + seed);
    const r = state.turn === 'bot' && !both ? botStep(state) : { action: policy(state) };
    if (!r.events) Object.assign(r, apply(state, r.action));
    actions.push(r.action); log.push(...r.events); state = r.state;
    for (const id of ['you', 'bot']) { const ptr = state.players[id].ptr; if (ptr < 1 || ptr > state.main.length) throw new Error(`pointer out of range: ${id} ${ptr}/${state.main.length}, seed ${seed}`); }
    onApply?.(state, r.events, action);
  }
  return { state, actions, log };
}
function replay(seed, actions, guided = false) {
  let { state, events } = createGame({ seed, guided });
  const log = [...events];
  for (const a of actions) { const r = apply(state, a); log.push(...r.events); state = r.state; }
  return { state, log };
}

// (a) + (b) + (c): many games, pointer invariant after every action, determinism from seed + actions
const seen = new Set();
const flatten = log => log.flatMap(e => e.type === 'BotActed' ? e.events : [e]);
function run(label, N, seedBase, policyFor, both = false) {
  const st = { games: 0, errors: 0, wins: { you: 0, bot: 0, draw: 0 }, tagged: 0, deadline: 0, down: 0 };
  for (let g = 0; g < N; g++) {
    const seed = seedBase + g;
    try {
      const { state, actions, log } = play(seed, policyFor(seed), { both });
      for (const e of [...log, ...flatten(log)]) seen.add(e.type);
      const again = replay(seed, actions);
      check(JSON.stringify(again.log) === JSON.stringify(flatten(log)), `${label} seed ${seed}: replay produced a different event log`);
      for (const e of log) if (e.type === 'BotActed') check(typeof REASON.bot[e.op]?.(e.why) === 'string', `${label} seed ${seed}: no bot copy for ${e.op}`);
      st.games++;
      if (flatten(log).some(e => e.type === 'Tagged')) st.tagged++; else st.deadline++;
      if (state.released.down) st.down++;
      st.wins[winner(state)]++;
    } catch (e) { st.errors++; fail(`${label} seed ${seed}: ${e.stack.split('\n').slice(0, 3).join(' | ')}`); }
  }
  console.log(label.padEnd(8), JSON.stringify(st));
  return st;
}
const randomPlayer = seed => { const r = testRng(seed * 7919); return s => randomAction(s, r); };
const smart = run('smart', 400, 1000, () => s => plan(s, 'you').action);
const random = run('random', 400, 5000, randomPlayer);
run('fuzz', 200, 9000, randomPlayer, true); // random on both sides reaches states the bot never would
// the bot should be beatable by a competent player (~3:1) and crush a random one (~20:1), as in play-vs-bot
check(smart.wins.you / smart.wins.bot > 1.8, 'a competent player should beat the bot about 3:1');
check(random.wins.bot / Math.max(1, random.wins.you) > 10, 'a random player should lose about 20:1');

// (f) every screen renders, in node, for every event of real games — the input screens with the payload the hub
// would open them with. html() is a pure string builder, so a broken screen shows up here without a browser.
const OPENS = { stage: a => ['I-Stage', { cards: a.cards }], commit: () => ['I-Commit', {}], pull: () => ['I-Pull', {}], blame: () => ['I-Target', { mode: 'blame' }], revert: () => ['I-Target', { mode: 'revert' }], force: () => ['I-Force', {}], tag: () => ['I-Tag', {}] };
const rendered = new Map();
function render(id, ctx, where) {
  try { const html = SCREENS[id].html(ctx); check(typeof html === 'string' && !/undefined|NaN|\[object/.test(html.replace(/data-[a-z-]+="[^"]*"/g, '')), `${id} rendered undefined/NaN at ${where}`); rendered.set(id, (rendered.get(id) || 0) + 1); }
  catch (e) { fail(`${id} threw at ${where}: ${e.stack.split('\n').slice(0, 2).join(' | ')}`); }
}
for (const [label, base, policyFor] of [['smart', 1000, () => st => plan(st, 'you').action], ['random', 5000, randomPlayer]]) {
  for (let g = 0; g < 150; g++) {
    const seed = base + g, policy = policyFor(seed), carry = {};
    let { state, events } = createGame({ seed, guided: g % 3 === 0 });
    const ui = { selected: [] }, show = (evs, before, after) => { for (const it of screensFor(evs, carry)) render(it.id, { e: it.event, s: after, before, ui, payload: {}, item: it }, `${label} ${seed} r${after.round}`); };
    show(events, state, state);
    while (!state.over) {
      const before = state;
      if (state.turn === 'you' && !state.pending) render('I-Hub', { s: state, before, ui }, `${label} ${seed}`);
      const r = state.turn === 'bot' ? botStep(state) : { action: policy(state) };
      if (!r.events) {
        const open = OPENS[r.action.type]?.(r.action);
        if (open) render(open[0], { s: state, before, ui, payload: open[1] }, `${label} ${seed}`);
        const { strategy, ...asked } = r.action; // the player never pre-declares: I-Conflict asks, as in the UI
        Object.assign(r, apply(state, r.action.type === 'pull' ? asked : r.action));
        if (r.state.pending) { show(r.events, before, r.state); const mid = r.state; Object.assign(r, apply(mid, { type: 'resolve', strategy: strategy || 'theirs' })); state = mid; }
      }
      state = r.state; show(r.events, before, state);
    }
  }
}
const unrendered = Object.keys(SCREENS).filter(id => id !== 'I-Start' && !rendered.has(id));
check(!unrendered.length, 'screens never rendered: ' + unrendered.join(', '));
console.log('screens ', [...rendered].map(([k, v]) => `${k}:${v}`).join(' '));

// (d) event coverage: every event type in spec §2 is emitted at least once
const SPEC_EVENTS = ['RoundStarted', 'TurnStarted', 'Staged', 'Committed', 'PushAccepted', 'PushRejected', 'Pulled', 'ConflictDetected', 'ConflictResolved', 'Blamed', 'Reverted', 'Forced', 'ReflogFired', 'Tagged', 'TurnEnded', 'BotActed', 'YouAreBehind', 'CIRan'];
const missing = SPEC_EVENTS.filter(t => !seen.has(t));
check(!missing.length, 'events never emitted: ' + missing.join(', '));
console.log('events  ', [...seen].sort().join(' '));

// the reflog rule: one card restores everything of the victim's that was erased, and is spent
{
  let { state: s } = createGame({ seed: 7 });
  s = structuredClone(s);
  const you = s.players.you, bot = s.players.bot;
  you.hand = [{ id: 'x1', cmd: 'reflog' }]; bot.hand = [{ id: 'x2', cmd: 'push --force' }];
  s.main.push({ id: 'y1', author: 'you', cards: [{ file: 'auth.js', lines: 4 }], flipped: false }, { id: 'y2', author: 'you', cards: [{ file: 'api.py', lines: 3 }], flipped: false });
  you.ptr = 3; bot.ptr = 1; bot.local = [{ id: 'b1', author: 'bot', cards: [{ file: 'README.md', lines: 2 }], flipped: false }];
  s.turn = 'bot'; s.ops = 3; s.incident = 'quiet';
  const r = apply(s, { type: 'force' });
  check(r.state.main.slice(1).map(c => c.id).join(' ') === 'b1 y1 y2', 'reflog: main should be init b1 y1 y2, got ' + r.state.main.map(c => c.id).join(' '));
  check(r.state.players.you.hand.length === 0 && behindBy(r.state, 'bot') === 2, 'reflog: card spent, bot 2 behind');
  check(r.events.map(e => e.type).join() === 'Forced,ReflogFired', 'reflog: events ' + r.events.map(e => e.type).join());
}

if (failures.length) { console.error(`\n${failures.length} failure(s)`); process.exit(1); }
console.log('\nsmoke test green');
