// I-Hub (spec §3): the player's home during their turn. main at the top, your branch in the middle, the hand fanned
// along the bottom, and one row of big actions, each saying what it would do in your situation — or, greyed, why not.
// The reasons come from the engine's legalActions, so the hub never restates the rules.
import { legalActions } from './engine.js';
import { plan } from './bot.js';
import { strip, standing, handCard, commitCard, scrollStripToTip, cardLabel, esc } from './view.js';
import { SCREEN, REASON, LABEL, INCIDENT } from './copy.js';

const T = SCREEN;
const CORE = ['stage', 'commit', 'push', 'pull'];
const CMD_OP = { 'git blame': 'blame', revert: 'revert', 'push --force': 'force' };

function why(o, ui, s) {
  if (o.key === 'stage') {
    const sel = s.players.you.hand.filter(c => ui.selected.includes(c.id) && !c.cmd);
    if (o.enabled || o.reason === 'no-ops') return o.enabled ? T.hub.ok.stage(sel.length, sel.reduce((a, c) => a + c.lines, 0)) : T.hub.no['no-ops'];
  }
  return o.enabled ? T.hub.ok[o.key](o.data) : T.hub.no[o.reason];
}
function opButton(o, ui, s, extra = '') {
  const noSel = o.key === 'stage' && !ui.selected.some(id => s.players.you.hand.find(c => c.id === id && !c.cmd));
  const enabled = o.enabled && !noSel;
  const danger = enabled && ((o.key === 'push' && o.data.behind) || o.key === 'force');
  const hinted = ui.hint && (ui.hint.action.type === o.action.type) ? 'hinted' : '';
  const label = `${T.hub.op[o.key]}, ${LABEL.card.cost(o.cost)}: ${why(o, ui, s)}`;
  return `<button class="op ${enabled && !danger ? 'go' : ''} ${danger ? 'danger' : ''} ${hinted} ${extra}" data-op="${o.key}" data-guide="${o.key}" aria-label="${esc(label)}" ${enabled ? '' : 'disabled'}>
    <span class="opname">${T.hub.op[o.key]}</span><span class="cost">${LABEL.card.cost(o.cost)}</span><span class="why">${why(o, ui, s)}</span></button>`;
}
// How many cards of width w fit in a row of the hand, each keeping a visible slice of at least 44 px (plus a margin).
const perRow = (room, w) => Math.max(1, Math.floor((room - w) / 46) + 1);
function handHTML(s, ui, layout) {
  const hand = [...s.players.you.hand].sort((a, z) => (!!a.cmd - !!z.cmd) || String(a.file).localeCompare(z.file) || a.lines - z.lines);
  // Full-size cards in at most two balanced rows; a hand too big for that (hands grow by about one card a turn) drops
  // to the strip-sized card. The width decides: 6 full-size cards a row on a phone, 10 or more on a tablet.
  const room = layout.width - 8, twoRows = Math.ceil(hand.length / perRow(room, layout.lg)) <= 2;
  const big = twoRows, per = big ? Math.ceil(hand.length / Math.max(1, Math.ceil(hand.length / perRow(room, layout.lg)))) : perRow(room, layout.md);
  const rows = []; for (let i = 0; i < hand.length; i += per) rows.push(hand.slice(i, i + per));
  const hintCards = ui.hint?.action.type === 'stage' ? ui.hint.action.cards : [];
  return rows.map(r => `<div class="hand-row ${big ? '' : 'small'}">${r.map(c => handCard(c, {
    size: big ? 'lg' : 'md', cls: [ui.selected.includes(c.id) ? 'selected' : '', hintCards.includes(c.id) ? 'hinted' : ''].join(' '),
    data: { 'data-card': c.id, 'data-guide': c.cmd ? 'command' : c.bug ? 'bugcard' : 'card', role: 'button', 'aria-pressed': ui.selected.includes(c.id), 'aria-label': cardLabel(c) + (c.bug ? `, ${LABEL.card.bug}` : '') },
  })).join('')}</div>`).join('');
}
function mineHTML(s) {
  const p = s.players.you;
  const staged = p.staged.length ? p.staged.map(c => handCard(c, { size: 'sm' })).join('') : `<span class="empty">${T.hub.empty}</span>`;
  const local = p.local.length ? p.local.map(c => commitCard(c, { size: 'sm', faceUp: true })).join('') : `<span class="empty">${T.hub.empty}</span>`;
  return `<div class="mine"><p class="incident-note"><span class="k">${LABEL.card.incident}</span> ${INCIDENT[s.incident].name} — ${INCIDENT[s.incident].text}</p>
    <div class="mine-head"><span class="k">${LABEL.branch}</span>${standing(s)}</div>
    <div class="zones"><div class="zone" data-zone="mat"><span class="k">${T.hub.mat}</span><div class="zcards">${staged}</div></div>
    <div class="zone" data-zone="local"><span class="k">${T.hub.local}</span><div class="zcards">${local}</div></div></div></div>`;
}

export const HUB = {
  html({ s, ui, layout = { width: 390, lg: 96, md: 64 } }) {
    ui.selected = (ui.selected || []).filter(id => s.players.you.hand.some(c => c.id === id));
    const opts = Object.fromEntries(legalActions(s).map(o => [o.key, o]));
    const selCmd = s.players.you.hand.find(c => c.cmd && ui.selected.includes(c.id));
    const cmdRow = !selCmd ? '' : CMD_OP[selCmd.cmd] ? opButton(opts[CMD_OP[selCmd.cmd]], ui, s, 'wide') : `<p class="trap">${T.hub.commandOnly(selCmd.cmd)}</p>`;
    const tag = opts.tag.enabled ? opButton(opts.tag, ui, s, 'wide') : '';
    const note = ui.toast ? `<p class="toast">${ui.toast}</p>` : ui.hint ? `<p class="hintline"><b>${T.hub.hint}</b> ${REASON.you[ui.hint.why.key](ui.hint.why)}</p>` : '';
    return `<div class="body hub">${strip(s)}${mineHTML(s)}</div>
      <div class="hand" data-hand>${handHTML(s, ui, layout)}</div>
      <div class="actions hub-actions">${note}${tag}${cmdRow}
        <div class="grid4">${CORE.map(k => opButton(opts[k], ui, s)).join('')}</div>
        <div class="minor"><button class="ghost" data-hint>${T.hub.hint}</button><button class="ghost" data-undo data-guide="undo" ${opts.undo.enabled ? '' : 'disabled'}>${T.hub.undo}</button><button class="ghost" data-op="endTurn" data-guide="endTurn">${T.hub.end}</button></div>
      </div>`;
  },
  mount(el, ctx) {
    const { s, api, ui } = ctx;
    const again = () => { el.innerHTML = HUB.html(ctx); HUB.mount(el, ctx); api.emit('shown', api.current, el); };
    scrollStripToTip(el); fitHand(el);
    ui.toast = null;
    el.querySelectorAll('[data-card]').forEach(card => card.onclick = () => {
      const id = card.dataset.card, c = s.players.you.hand.find(x => x.id === id);
      const has = ui.selected.includes(id);
      // commit cards combine into one add; a command card is played alone, so selecting one clears the rest
      if (c.cmd) ui.selected = has ? [] : [id];
      else ui.selected = has ? ui.selected.filter(x => x !== id) : [...ui.selected.filter(x => !s.players.you.hand.find(h => h.id === x)?.cmd), id];
      api.emit('select', c); again();
    });
    const go = {
      stage: () => api.open('I-Stage', { cards: ui.selected.filter(id => !s.players.you.hand.find(c => c.id === id).cmd) }),
      commit: () => api.open('I-Commit'), pull: () => api.open('I-Pull'), tag: () => api.open('I-Tag'), force: () => api.open('I-Force'),
      blame: () => api.open('I-Target', { mode: 'blame' }), revert: () => api.open('I-Target', { mode: 'revert' }),
      push: () => api.dispatch({ type: 'push' }), endTurn: () => api.dispatch({ type: 'endTurn' }),
    };
    el.querySelectorAll('[data-op]').forEach(b => b.onclick = () => { ui.hint = null; go[b.dataset.op](); });
    el.querySelector('[data-undo]').onclick = () => { ui.hint = null; ui.toast = T.hub.undone; api.dispatch({ type: 'undo' }); };
    el.querySelector('[data-hint]').onclick = () => {
      ui.hint = plan(s, 'you');
      if (ui.hint.action.type === 'stage') ui.selected = [...ui.hint.action.cards];
      api.emit('hint', ui.hint); again();
    };
  },
};
// Overlap the hand so a row always fits the width, keeping at least 44 px of every card tappable.
function fitHand(el) {
  const hand = el.querySelector('[data-hand]'); if (!hand) return;
  for (const row of hand.querySelectorAll('.hand-row')) {
    const n = row.children.length, w = row.firstElementChild?.offsetWidth || 96;
    const room = hand.clientWidth - 8;
    row.style.setProperty('--overlap', n > 1 ? Math.min(6, (room - n * w) / (n - 1)) + 'px' : '0px');
  }
}

