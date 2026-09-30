// The guided first game (spec §3): not separate screens but a layer on the frame that highlights the one element
// to tap and says one sentence. The steps are a small pure reducer — advance(guide, signal) — so the smoke test can
// walk them over hundreds of seeds; mount() is the only part that touches the DOM.
import { GUIDE } from './copy.js';

export const STEPS = ['select', 'add', 'commit', 'push', 'watch', 'pull', 'select', 'add', 'commit', 'done'];
export const createGuide = () => ({ step: 0, skippedPull: false });
export const expecting = g => g && g.step < STEPS.length ? STEPS[g.step] : null;

// Signals: { type: 'select', card }, { type: 'action', action }, { type: 'turn', player, behindBy }, { type: 'dismiss' }.
export function advance(g, sig) {
  const want = expecting(g); if (!want) return g;
  const next = { ...g, step: g.step + 1 };
  if (want === 'select' && sig.type === 'select' && !sig.card.cmd) return next;
  if (want === 'add' && sig.action?.type === 'stage') return next;
  if (want === 'commit' && sig.action?.type === 'commit') return next;
  if (want === 'push' && sig.action?.type === 'push') return next;
  if (want === 'pull' && sig.action?.type === 'pull') return next;
  if (want === 'done' && (sig.type === 'dismiss' || sig.type === 'action')) return next;
  if (want === 'watch' && sig.type === 'turn' && sig.player === 'you') {
    // The bot pulled and committed but ran out of ops before it pushed: the "you are behind" lesson has to wait.
    return sig.behindBy ? next : { ...next, step: STEPS.indexOf('select', next.step), skippedPull: true };
  }
  return g;
}

// Which elements carry the highlight for each step, on whichever screen shows them.
const TARGETS = {
  select: '[data-guide=card]', add: '[data-guide=stage], [data-guide=add]', commit: '[data-guide=commit]',
  push: '[data-guide=push]', pull: '[data-guide=pull]',
};
// The sentence belongs on the screens where the step is being asked for; consequence screens speak for themselves.
const SHOWN_ON = {
  select: ['I-Hub'], add: ['I-Hub', 'I-Stage'], commit: ['I-Hub', 'I-Commit'], push: ['I-Hub'],
  watch: ['O-TurnSummary', 'O-BotTurn', 'O-BotStep'], pull: ['I-Hub', 'I-Pull', 'I-Conflict'], done: ['I-Hub'],
};

export function mount(g, item, el, onSkip) {
  el.querySelectorAll('.guide-bubble').forEach(b => b.remove());
  el.querySelectorAll('.guide-target').forEach(t => t.classList.remove('guide-target'));
  const want = expecting(g);
  if (!want || !SHOWN_ON[want].includes(item.id)) return;
  const text = want === 'select' && g.skippedPull && g.step === STEPS.indexOf('select', 5) ? GUIDE.skippedPull : GUIDE[want][item.id] ?? GUIDE[want].text;
  const bubble = document.createElement('div');
  bubble.className = 'guide-bubble';
  bubble.innerHTML = `<span class="guide-step">${GUIDE.step(Math.min(g.step + 1, STEPS.length), STEPS.length)}</span><p>${text}</p><button class="ghost" data-skip-guide>${want === 'done' ? GUIDE.gotIt : GUIDE.skip}</button>`;
  bubble.querySelector('[data-skip-guide]').onclick = onSkip;
  el.querySelector('.body')?.prepend(bubble);
  if (TARGETS[want]) {
    // one element: the first card without a BUG tag, or the button for this step
    const t = el.querySelector(TARGETS[want]) || (want === 'select' && el.querySelector('[data-guide=bugcard]'));
    t?.classList.add('guide-target');
  }
}

// Wire the guide to the router: it listens, it never drives. The turn signal is taken when O-YourTurn is shown,
// not when the event arrives, so the "watch the bot" sentence stays up for the whole of the bot's turn.
export function install(api) {
  let g = null;
  const skip = () => { g = null; const el = document.querySelector('.screen'); if (api.current && el) mount(g, api.current, el, skip); };
  api.on((kind, x, el) => {
    if (kind === 'newGame') { g = x.guided ? createGuide() : null; return; }
    if (!g) return;
    if (kind === 'select') g = advance(g, { type: 'select', card: x });
    if (kind === 'action') g = advance(g, { type: 'action', action: x });
    if (kind === 'shown' && x.id === 'O-YourTurn') g = advance(g, { type: 'turn', player: 'you', behindBy: x.event.behindBy });
    if (kind === 'shown') mount(g, x, el, skip);
  });
}
