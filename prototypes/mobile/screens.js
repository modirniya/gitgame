// One render function per screen id in the spec (§3). This file holds the input screens — the ones that ask one
// question and return one action — and the registry; outcomes.js holds the screens that show a consequence.
// A screen is { html(ctx), mount?(el, ctx), auto?(ctx) }, where ctx = { e: event, s: state shown, api, ui }.
import { legalActions, behindBy, conflictsFor, lines, commitsOnMain, scores } from './engine.js';
import { strip, standing, handCard, commitCard, esc, scrollStripToTip } from './view.js';
import { SCREEN, REASON, BRAND, suggestMessages } from './copy.js';
import { LAZY_MESSAGES } from './engine.js';
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


// A question screen: title, what you are about to do, and the answer buttons at the thumb.
function ask({ title, tone = '', scene = '', said = '', then = '', warn = '', buttons }) {
  return `<div class="body ask ${tone}"><h1 class="cmd">${title}</h1>${scene ? `<div class="scene">${scene}</div>` : ''}
    ${said ? `<p class="said">${said}</p>` : ''}${warn ? `<p class="warnline">${warn}</p>` : ''}${then ? `<p class="then">${then}</p>` : ''}</div>
    <div class="actions">${buttons}</div>`;
}
const cancel = label => `<button class="ghost" data-next data-guide="cancel">${label}</button>`;

// ---------- I-Stage: which cards become the next commit ----------
SCREENS['I-Stage'] = {
  html({ s, payload }) {
    const p = s.players.you, cards = payload.cards.map(id => p.hand.find(c => c.id === id));
    const all = [...p.staged, ...cards], total = all.reduce((a, c) => a + c.lines, 0);
    return ask({
      title: T.stage.title,
      scene: `<div class="spread">${cards.map(c => handCard(c, { size: 'lg' })).join('')}</div>`,
      said: T.stage.forms(total, p.staged.length > 0),
      warn: all.some(c => c.bug) ? T.stage.bug : '',
      then: all.length > 1 ? T.stage.big : '',
      buttons: `${cancel(T.stage.cancel)}<button class="primary" data-go data-guide="add">${T.stage.add(cards.length)}</button>`,
    });
  },
  mount(el, { api, payload, ui }) { el.querySelector('[data-go]').onclick = () => { ui.selected = []; api.dispatch({ type: 'stage', cards: payload.cards }); }; },
};

// ---------- I-Commit: the mat becomes one commit, with a message ----------
SCREENS['I-Commit'] = {
  html({ s }) {
    const p = s.players.you, [first, second] = suggestMessages(p.staged);
    return ask({
      title: T.commit.title,
      scene: `<div class="spread tight">${p.staged.map(c => handCard(c, { size: 'md' })).join('')}</div>`,
      said: `<label class="msg"><span class="k">${T.commit.label}</span><input data-msg type="text" value="${esc(first)}" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done"></label>
        <span class="chips">${[first, second].map(m => `<button class="chip" data-chip="${esc(m)}">${esc(m)}</button>`).join('')}</span>`,
      warn: `<span data-lazy hidden>${T.commit.lazyWarn}</span>`,
      then: T.commit.rule,
      buttons: `${cancel(T.commit.cancel)}<button class="primary" data-go data-guide="commit">${T.commit.commit}</button>`,
    });
  },
  mount(el, { api }) {
    const input = el.querySelector('[data-msg]'), lazy = el.querySelector('[data-lazy]');
    const check = () => { lazy.hidden = !LAZY_MESSAGES.includes(input.value.trim().toLowerCase()); lazy.parentElement.classList.toggle('on', !lazy.hidden); };
    input.oninput = check; check();
    el.querySelectorAll('[data-chip]').forEach(b => b.onclick = () => { input.value = b.dataset.chip; check(); });
    const go = () => api.dispatch({ type: 'commit', message: input.value.trim() || 'Initial work' });
    el.querySelector('[data-go]').onclick = go;
    input.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); } };
  },
};

// Placeholders until their group of the plan replaces them.
const quick = (label, act) => ({
  html: () => `<div class="body"><h1>${label}</h1></div><div class="actions"><button data-next class="ghost">Cancel</button><button class="primary" data-go>${label}</button></div>`,
  mount: (el, ctx) => { el.querySelector('[data-go]').onclick = () => ctx.api.dispatch(act(ctx)); },
});
SCREENS['I-Pull'] = quick('I-Pull', () => ({ type: 'pull', rebase: false }));
SCREENS['I-Conflict'] = quick('I-Conflict', () => ({ type: 'resolve', strategy: 'theirs' }));
SCREENS['I-Target'] = quick('I-Target', ({ s, payload }) => ({ type: payload.mode, target: legalActions(s).find(o => o.key === payload.mode).data.targets[0] }));
SCREENS['I-Force'] = quick('I-Force', () => ({ type: 'force' }));
SCREENS['I-Tag'] = quick('I-Tag', () => ({ type: 'tag' }));
