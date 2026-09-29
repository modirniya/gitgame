// The frame around every screen: the status bar (round, main, ops, live score) and the Table (spec §3, "Frame" and
// "Table"). On a phone the Table is a sheet one tap away; where the screen is wide enough (a laptop, an iPad in
// landscape) it is a panel beside the screen, with a log of what has happened, because there is room to keep the
// shared view in sight. It always draws the state of the screen being shown, not the latest state, so neither the
// score nor the log runs ahead of what the player has seen.
import { scores, commitsOnMain, MAX_ROUNDS, RELEASE_AT } from './engine.js';
import { strip, scrollStripToTip, pips, esc } from './view.js';
import { INCIDENT, TABLE, LABEL, LOG, RECEIPT, BOT_DID, BOT_TITLE } from './copy.js';

const $ = sel => document.querySelector(sel);
let shown = null; // the state of the screen on display, for redrawing the panel when the window is resized

export function renderFrame(item, api) {
  const s = item.after, bar = $('#status');
  $('#app').classList.toggle('in-game', !!s);
  if (!s) { bar.innerHTML = ''; bar.hidden = true; $('#table-pane').innerHTML = ''; log.length = 0; return; }
  bar.hidden = false;
  const sc = scores(s), owner = item.owner ?? s.turn;
  const ops = !s.over && s.turn === owner ? s.ops : 0;
  bar.innerHTML = `
    <span class="st-round">${LABEL.status.round} <b>${item.round ?? s.round}</b>/${MAX_ROUNDS}</span>
    <span class="st-main">${LABEL.status.main} <b>${commitsOnMain(s)}</b>/${RELEASE_AT}</span>
    ${pips(ops, 3, owner)}
    <span class="st-score" aria-label="${LABEL.status.score}"><b class="you">${LABEL.you} ${sc.you.total}</b> · <b class="bot">${LABEL.bot} ${sc.bot.total}</b></span>
    <button class="st-table" data-table aria-label="${LABEL.status.openTable}">${LABEL.status.table}</button>`;
  bar.querySelector('[data-table]').onclick = () => openTable(item, api);
  logItems([item]);
  shown = s; renderPane(s);
}

function tokens(s, id) {
  const p = s.players[id], t = [];
  if (p.merge) t.push(`<span class="tok neg">${LABEL.tokens.merge(p.merge)}</span>`);
  if (p.grudges) t.push(`<span class="tok neg">${LABEL.tokens.grudge(p.grudges)}</span>`);
  if (p.sin) t.push(`<span class="tok neg">${LABEL.tokens.sin(p.sin)}</span>`);
  if (p.blame) t.push(`<span class="tok neg">${LABEL.tokens.blame(p.blame)}</span>`);
  if (p.fixes) t.push(`<span class="tok pos">${LABEL.tokens.fixes(p.fixes)}</span>`);
  return t.join('') || `<span class="tok none">${TABLE.noTokens}</span>`;
}

// What the Table shows, as a sheet or as a panel: main in full, the incident, both players' public state.
function tableHTML(s, { wrap = false } = {}) {
  const inc = INCIDENT[s.incident], person = id => {
    const p = s.players[id];
    return `<div class="person ${id}"><h3>${LABEL[id]}</h3><p>${LABEL.counts(p.hand.length, p.staged.length, p.local.length)}</p><div class="toks">${tokens(s, id)}</div></div>`;
  };
  return `${strip(s, { wrap })}
    <div class="incident-line"><span class="k">${TABLE.incident}</span> <b>${esc(inc.name)}</b> — ${esc(inc.text)}</div>
    <div class="people">${person('you')}${person('bot')}</div>`;
}

function openTable(item, api) {
  const sheet = $('#sheet');
  api.emit('table', item);
  sheet.innerHTML = `<div class="sheet-card" role="dialog" aria-label="${TABLE.title}">
    <div class="sheet-head"><h2>${TABLE.title}</h2><button data-close class="ghost">${TABLE.close}</button></div>
    ${tableHTML(item.after)}<p class="fine">${TABLE.fine}</p></div>`;
  sheet.hidden = false;
  scrollStripToTip(sheet);
  const close = () => { sheet.hidden = true; sheet.innerHTML = ''; };
  sheet.querySelector('[data-close]').onclick = close;
  sheet.onclick = ev => { if (ev.target === sheet) close(); };
}

// ---------- the panel and its log (wide screens; hidden by CSS elsewhere) ----------
const log = [];
// One line per consequence the player saw — or would have seen: "skip bot" hands its dropped screens here too, so
// the log still says what the bot did. Pure function of the screen item; the words are copy.js's.
function lineFor({ id, event: e }) {
  if (!e) return null;
  if (id === 'O-Incident') { if (e.round === 1) log.length = 0; return { cls: 'round', html: LOG.round(e.round, INCIDENT[e.incident].name) }; }
  if (id === 'O-BotStep') return { cls: 'bot', html: LOG.bot(BOT_TITLE[e.op] + (e.why.target ? ` ${e.why.target}` : ''), e.events.map(x => BOT_DID[x.type]?.(x)).filter(Boolean).join(' ')) };
  if (id === 'O-CI') return { cls: 'round', html: LOG.ci(e.bugs, e.productionDown) };
  if (id === 'O-Reflog') return { cls: e.victim, html: LOG[e.victim](esc(RECEIPT.ReflogFired(e).trim())) };
  if (e.player === 'you' && RECEIPT[e.type]) return { cls: 'you', html: LOG.you(esc(RECEIPT[e.type](e).trim())) };
  return null;
}
export function logItems(items) { for (const it of items) { const l = lineFor(it); if (l) log.push(l); } log.splice(0, log.length - 60); }

export const refreshPane = () => { if (shown) renderPane(shown); };
function renderPane(s) {
  const pane = $('#table-pane');
  if (!pane || getComputedStyle(pane).display === 'none') return; // phone: the sheet does this job
  pane.innerHTML = `<h2 class="pane-title">${TABLE.title}</h2>${tableHTML(s, { wrap: true })}
    <section class="log"><h3 class="k">${LOG.title}</h3><ol>${log.slice().reverse().map(l => `<li class="${l.cls}">${l.html}</li>`).join('') || `<li class="none">${LOG.empty}</li>`}</ol></section>`;
}
