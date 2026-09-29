// One render function per screen id in the spec (§3). This file holds the input screens — the ones that ask one
// question and return one action — and the registry; outcomes.js holds the screens that show a consequence.
// A screen is { html(ctx), mount?(el, ctx), auto?(ctx) }, where ctx = { e: event, s: state shown, api, ui }.
import { legalActions, behindBy, conflictsFor, lines, commitsOnMain, scores } from './engine.js';
import { strip, standing, handCard, commitCard, esc, scrollStripToTip } from './view.js';
import { SCREEN, REASON, BRAND } from './copy.js';
import { OUTCOMES } from './outcomes.js';
import { HUB } from './hub.js';

const T = SCREEN;
export const SCREENS = { ...OUTCOMES, 'I-Hub': HUB };
const byId = (s, id) => s.main.find(c => c.id === id);
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };

// ---------- I-Start ----------
SCREENS['I-Start'] = {
  html: () => {
    const played = +(store.get('gitgame.games') || 0);
    return `<div class="body start">
      <div class="logo"><span class="prompt">$ git init</span><h1>${BRAND.name}</h1><p>${BRAND.tagline}</p></div>
      <p class="pitch">${T.start.pitch}</p>
      <label class="toggle"><input type="checkbox" data-guided ${played ? '' : 'checked'}><span><b>${T.start.guided}</b><small>${T.start.guidedNote}</small></span></label>
    </div>
    <div class="actions"><button class="primary" data-new>${T.start.go}</button></div>`;
  },
  mount(el, { api }) {
    document.title = `${BRAND.name} · mobile prototype`;
    const seed = new URLSearchParams(location.search).get('seed');
    el.querySelector('[data-new]').onclick = () => api.newGame({ guided: el.querySelector('[data-guided]').checked, ...(seed && { seed: +seed }) });
  },
};


// Placeholders until their group of the plan replaces them.
const quick = (label, act) => ({
  html: () => `<div class="body"><h1>${label}</h1></div><div class="actions"><button data-next class="ghost">Cancel</button><button class="primary" data-go>${label}</button></div>`,
  mount: (el, ctx) => { el.querySelector('[data-go]').onclick = () => ctx.api.dispatch(act(ctx)); },
});
SCREENS['I-Stage'] = quick('I-Stage', ({ payload }) => ({ type: 'stage', cards: payload.cards }));
SCREENS['I-Commit'] = quick('I-Commit', ({ s }) => ({ type: 'commit', message: 'feat: placeholder' }));
SCREENS['I-Pull'] = quick('I-Pull', () => ({ type: 'pull', rebase: false }));
SCREENS['I-Conflict'] = quick('I-Conflict', () => ({ type: 'resolve', strategy: 'theirs' }));
SCREENS['I-Target'] = quick('I-Target', ({ s, payload }) => ({ type: payload.mode, target: legalActions(s).find(o => o.key === payload.mode).data.targets[0] }));
SCREENS['I-Force'] = quick('I-Force', () => ({ type: 'force' }));
SCREENS['I-Tag'] = quick('I-Tag', () => ({ type: 'tag' }));
