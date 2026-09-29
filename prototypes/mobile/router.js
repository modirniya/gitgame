// The router turns the engine's event stream into a queue of screens and plays it forward (spec §2, §3).
// After every apply() the events are mapped to output screens and queued; when the queue is empty and it is the
// player's turn, the hub is shown; when it is the bot's turn, the router asks the bot for one more op. Nothing here
// decides what happened in the game — screens only ever show an event, or ask for an action.
import { createGame, apply } from './engine.js';
import { botStep } from './bot.js';
import { SCREENS } from './screens.js';
import { renderFrame } from './frame.js';
import { animate, clearFlights } from './motion.js';

export const AUTO = { 'O-BotTurn': 1000, 'O-BotStep': 1200, 'O-Staged': 900 }; // ms; O-CI sets its own from the number of flips
// What "skip bot" still shows: the tip moving past you, your commits being erased or restored, and the end.
const MUST_SEE = new Set(['O-Behind', 'O-Forced', 'O-Reflog', 'O-CI', 'O-Scoreboard', 'O-Incident', 'O-YourTurn']);

// Pure: the screens one batch of events produces, as the player sees them. `carry` holds the O-Behind interstitial
// between batches: the tip moves mid-turn, but the lesson is shown when the bot's turn ends (spec §3, O-Behind).
export function screensFor(events, carry = {}) {
  const out = [];
  const mine = (e, id) => e.player === 'you' ? [{ id, event: e }] : [];
  for (const e of events) {
    switch (e.type) {
      case 'RoundStarted': out.push({ id: 'O-Incident', event: e }); break;
      case 'TurnStarted': out.push({ id: e.player === 'you' ? 'O-YourTurn' : 'O-BotTurn', event: e }); if (e.player === 'bot') carry.botOps = e.ops; break;
      case 'Staged': out.push(...mine(e, 'O-Staged')); break;
      case 'Committed': out.push(...mine(e, 'O-Committed')); break;
      case 'PushAccepted': out.push(...mine(e, 'O-Pushed')); break;
      case 'PushRejected': out.push(...mine(e, 'O-Rejected')); break;
      case 'ConflictDetected': out.push(...mine(e, 'I-Conflict')); break;
      case 'ConflictResolved': out.push(...mine(e, 'O-Resolved')); break;
      case 'Pulled': out.push(...mine(e, 'O-Pulled')); break;
      case 'Blamed': out.push(...mine(e, 'O-Blamed')); break;
      case 'Reverted': out.push(...mine(e, 'O-Reverted')); break;
      case 'Forced': out.push({ id: 'O-Forced', event: e }); break;
      case 'ReflogFired': out.push({ id: 'O-Reflog', event: e }); break;
      case 'TurnEnded':
        if (e.player === 'you') out.push({ id: 'O-TurnSummary', event: e });
        else if (carry.behind) { out.push(carry.behind); carry.behind = null; }
        break;
      case 'BotActed':
        out.push({ id: 'O-BotStep', event: e, of: carry.botOps });
        out.push(...screensFor(e.events.filter(x => x.type === 'Forced' || x.type === 'ReflogFired'), carry)); // too big to fold into a bubble
        break;
      case 'YouAreBehind': carry.behind = { id: 'O-Behind', event: e }; break;
      case 'CIRan': carry.behind = null; out.push({ id: 'O-CI', event: e }, { id: 'O-Scoreboard', event: e }); break;
      // Tagged and Undone are shown inside the screens around them (O-CI, O-Pushed, the hub).
    }
  }
  return out;
}

const R = { root: null, game: null, queue: [], current: null, carry: {}, timer: null, ui: {}, skipping: false, listeners: [], seedCounter: 0 };

function enqueue(events, before, after) {
  // One apply can span a turn change; the frame shows each screen's own round and whose ops the pips count.
  let round = before?.round ?? after.round;
  for (const item of screensFor(events, R.carry)) {
    if (item.id === 'O-Incident') round = item.event.round;
    const owner = item.event?.player ?? (['O-BotStep', 'O-Behind'].includes(item.id) ? 'bot' : after.turn);
    if (R.skipping && !MUST_SEE.has(item.id)) continue;
    R.queue.push({ ...item, before, after, round, owner });
  }
  api.emit('events', events);
}

export const api = {
  get game() { return R.game; },
  get current() { return R.current; },
  ui: R.ui,
  on(f) { R.listeners.push(f); },
  emit(kind, ...args) { for (const f of R.listeners) f(kind, ...args); },
  newGame(opts) {
    const seed = opts.seed ?? ((Date.now() ^ (++R.seedCounter * 2654435761)) >>> 0);
    const { state, events } = createGame({ ...opts, seed });
    Object.assign(R, { game: state, queue: [], carry: {}, skipping: false });
    for (const k of Object.keys(R.ui)) delete R.ui[k];
    api.emit('newGame', state);
    enqueue(events, state, state);
    api.next();
  },
  dispatch(action) {
    const before = R.game, r = apply(before, action);
    R.game = r.state;
    api.emit('action', action);
    enqueue(r.events, before, r.state);
    api.next();
  },
  // An input screen the hub opens (I-Stage, I-Pull, …): it asks a question and moves no game state until answered.
  open(id, payload = {}) { show({ id, payload, before: R.game, after: R.game }); },
  next(how = 'tap') {
    clearTimeout(R.timer);
    if (R.current) api.emit('leave', R.current, how);
    R.current = null; // next() recurses while the bot plays; the screen is left once
    if (R.queue.length) return show(R.queue.shift());
    const s = R.game;
    if (!s || s.over) return show({ id: 'I-Start', before: s, after: s });
    if (s.turn === 'bot') { // the bot's next op is only computed once the player has seen the last one
      const before = s, r = botStep(s);
      R.game = r.state;
      enqueue(r.events, before, r.state);
      return api.next('auto');
    }
    R.skipping = false;
    show({ id: 'I-Hub', before: s, after: s });
  },
  // Jump to the end of the bot's turn, still showing what the player must not miss (spec §5).
  skipBot() {
    api.emit('skip', R.current);
    R.skipping = true;
    R.queue = R.queue.filter(item => MUST_SEE.has(item.id));
    api.next('skip');
  },
};

function show(item) {
  clearFlights();
  R.current = item;
  api.emit('enter', item);
  const screen = SCREENS[item.id];
  const ctx = { e: item.event, s: item.after, before: item.before, payload: item.payload, item, api, ui: R.ui };
  renderFrame(item, api);
  R.root.innerHTML = `<section class="screen" data-screen="${item.id}">${screen.html(ctx)}</section>`;
  R.root.scrollTop = 0;
  const el = R.root.firstElementChild;
  screen.mount?.(el, ctx);
  animate(el, item);
  const auto = screen.auto?.(ctx) ?? AUTO[item.id];
  if (auto) {
    el.style.setProperty('--auto', auto + 'ms'); el.classList.add('auto'); // a bar shows the screen will move on by itself
    R.timer = setTimeout(() => api.next('auto'), auto);
    el.addEventListener('click', ev => { if (!ev.target.closest('button')) api.next('tap'); }); // tap anywhere advances early
  }
  el.querySelectorAll('[data-next]').forEach(b => b.addEventListener('click', () => api.next('tap')));
  el.querySelectorAll('[data-skip-bot]').forEach(b => b.addEventListener('click', () => api.skipBot()));
}

export function start(root) {
  R.root = root;
  show({ id: 'I-Start', before: null, after: null });
}
