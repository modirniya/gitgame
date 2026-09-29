// One render function per screen id in the spec (§3). This file holds the input screens — the ones that ask one
// question and return one action — and the registry; outcomes.js holds the screens that show a consequence.
// A screen is { html(ctx), mount?(el, ctx), auto?(ctx) }, where ctx = { e: event, s: state shown, api, ui }.
import { legalActions, behindBy, conflictsFor, lines, commitsOnMain, scores } from './engine.js';
import { strip, handCard, commitCard, commitLabel, esc, scrollStripToTip, WHO } from './view.js';
import { SCREEN, BRAND, GIT, LABEL, COMMAND, suggestMessages } from './copy.js';
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
      <div class="logo"><span class="prompt">${LABEL.prompt}</span><h1>${BRAND.name}</h1><p>${BRAND.tagline}</p></div>
      <p class="pitch">${T.start.pitch}</p>
      <label class="toggle"><input type="checkbox" data-guided aria-label="${T.start.guided}" ${played ? '' : 'checked'}><span><b>${T.start.guided}</b><small>${T.start.guidedNote}</small></span></label>
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
      said: `<label class="msg"><span class="k">${T.commit.label}</span><input data-msg type="text" value="${esc(first)}" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="go"></label>
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
    input.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); go(); } }; // the message is the last thing asked
  },
};

// ---------- I-Pull: plain pull or rebase, with the conflict (if any) announced on both ----------
SCREENS['I-Pull'] = {
  html({ s }) {
    const opts = legalActions(s), p = s.players.you;
    const incoming = s.main.slice(p.ptr).map(c => c.id), conf = conflictsFor(s, 'you');
    const choice = (key, name, whyText) => {
      const o = opts.find(x => x.key === key);
      return `<button class="choice" data-pull="${key}" data-guide="${key}" aria-label="${esc(`${name}: ${o.enabled ? whyText : T.hub.no[o.reason]}`)}" ${o.enabled ? '' : 'disabled'}><span class="opname">${name}</span>
        <span class="why">${o.enabled ? whyText : T.hub.no[o.reason]}</span>${conf.length && o.enabled ? `<span class="why bad">${T.pull.conflict(conf[0].shared[0])}</span>` : ''}</button>`;
    };
    return `<div class="body ask"><h1 class="cmd">${T.pull.title}</h1>${strip(s, { mark: incoming })}
      <p class="said">${T.pull.said(incoming.length, incoming)}</p></div>
      <div class="actions stack">${choice('pull', T.pull.plain, T.pull.plainWhy)}${choice('rebase', T.pull.rebase, T.pull.rebaseWhy)}${cancel(T.pull.cancel)}</div>`;
  },
  mount(el, { api }) {
    scrollStripToTip(el);
    el.querySelectorAll('[data-pull]').forEach(b => b.onclick = () => api.dispatch({ type: 'pull', rebase: b.dataset.pull === 'rebase' }));
  },
};

// ---------- I-Conflict: the one question Git can't answer for you ----------
SCREENS['I-Conflict'] = {
  html({ s, e }) {
    const p = s.players.you, k = e.conflicts[0], file = k.shared[0];
    const mine = [...new Set(e.conflicts.map(x => x.mine))].map(id => p.local.find(c => c.id === id));
    const theirs = e.conflicts.map(x => byId(s, x.theirs));
    const myLines = mine.reduce((a, c) => a + lines(c), 0), theirLines = theirs.reduce((a, c) => a + lines(c), 0);
    const base = e.rebase ? 2 : 1;
    const btn = (key, name, whyText) => { const ok = e.affordable.includes(key); return `<button class="choice" data-s="${key}" data-guide="${key}" aria-label="${esc(`${name}: ${ok ? whyText : T.conflict.cantAfford}`)}" ${ok ? '' : 'disabled'}><span class="opname">${name}</span><span class="why">${ok ? whyText : T.conflict.cantAfford}</span></button>`; };
    return `<div class="body ask bad"><h1 class="cmd">${COMMAND.conflict}</h1><pre class="term bad">${esc(GIT.conflict(file))}</pre>
      <div class="scene clash" data-anim="clash">
        <div class="labelled">${commitCard(mine[0], { size: 'lg', faceUp: true })}<span class="who"><b class="you">${LABEL.yours}</b> ${LABEL.lines(lines(mine[0]))}</span></div>
        <span class="clash-file">${esc(file)}</span>
        <div class="labelled">${commitCard(theirs[0], { size: 'lg' })}<span class="who"><b class="bot">${LABEL.theirs}</b> ${LABEL.lines(lines(theirs[0]))}</span></div></div>
      <p class="said">${T.conflict.said(k.mine, k.theirs)}</p></div>
      <div class="actions stack">${btn('ours', T.conflict.ours, T.conflict.oursWhy(theirLines))}${btn('theirs', T.conflict.theirs, T.conflict.theirsWhy(myLines))}${btn('resolve', T.conflict.resolve, T.conflict.resolveWhy(base + 1))}</div>`;
  },
  mount(el, { api }) { el.querySelectorAll('[data-s]').forEach(b => b.onclick = () => api.dispatch({ type: 'resolve', strategy: b.dataset.s })); },
};

// ---------- I-Target: main enlarged, the commits you may blame (face-down) or revert (flipped bugs) lit ----------
SCREENS['I-Target'] = {
  html({ s, payload }) {
    const mode = payload.mode, targets = legalActions(s).find(o => o.key === mode).data.targets;
    const cells = s.main.map(c => {
      const t = targets.includes(c.id);
      return `<button class="cell ${t ? 'target' : ''}" data-target="${c.id}" data-guide="target" ${t ? '' : 'disabled'} aria-label="${esc(c.id)}">
        ${commitCard(c, { size: 'md' })}<span class="who">${c.init ? '' : `<b class="${c.author}">${WHO[c.author]}</b> ${esc(commitLabel(c))}`}</span></button>`;
    }).join('');
    return `<div class="body ask"><h1 class="cmd">${T.target[mode]}</h1><p class="said">${T.target[mode + 'Said']}</p><div class="cells">${cells}</div></div>
      <div class="actions">${cancel(T.target.cancel)}</div>`;
  },
  mount(el, { api, payload }) {
    el.querySelectorAll('.cell.target').forEach(b => b.onclick = () => api.dispatch({ type: payload.mode, target: b.dataset.target }));
    el.querySelector('.cell.target:last-of-type')?.scrollIntoView({ block: 'nearest' });
  },
};

// ---------- I-Force: the warning, with the actual cards that would be erased ----------
SCREENS['I-Force'] = {
  html({ s }) {
    const p = s.players.you, erased = s.main.slice(p.ptr);
    return ask({
      title: T.force.title, tone: 'bad',
      scene: `<div class="spread">${erased.map(c => `<div class="labelled">${commitCard(c, { size: 'md' })}<span class="who"><b class="${c.author}">${WHO[c.author]}</b> ${esc(commitLabel(c))}</span></div>`).join('')}</div>`,
      said: T.force.said(erased.length), warn: T.force.sin, then: T.force.reflog,
      buttons: `${cancel(T.force.cancel)}<button class="danger primary" data-go data-guide="force">${T.force.go}</button>`,
    });
  },
  mount(el, { api }) { el.querySelector('[data-go]').onclick = () => api.dispatch({ type: 'force' }); },
};

// ---------- I-Tag: end the game now? ----------
SCREENS['I-Tag'] = {
  html({ s }) {
    const sc = scores(s);
    return ask({
      title: T.tag.title, scene: `<div class="score-now"><b class="you">${LABEL.you} ${sc.you.total}</b><span>·</span><b class="bot">${LABEL.bot} ${sc.bot.total}</b></div>`,
      said: T.tag.said(commitsOnMain(s)), then: sc.you.total >= sc.bot.total ? T.tag.ahead : T.tag.behind,
      buttons: `<button class="ghost" data-next>${T.tag.later}</button><button class="primary" data-go data-guide="tag">${T.tag.go}</button>`,
    });
  },
  mount(el, { api }) { el.querySelector('[data-go]').onclick = () => api.dispatch({ type: 'tag' }); },
};
