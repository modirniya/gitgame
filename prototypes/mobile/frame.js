// The frame around every screen: the status bar (round, main, ops, live score) and the Table sheet, the shared
// view one tap away (spec §3, "Frame" and "Table"). It always draws the state of the screen being shown, not the
// latest state, so the score doesn't jump ahead of what the player has seen.
import { scores, commitsOnMain, MAX_ROUNDS, RELEASE_AT } from './engine.js';
import { strip, scrollStripToTip, pips, esc } from './view.js';
import { INCIDENT, TABLE, plural } from './copy.js';

const $ = sel => document.querySelector(sel);

export function renderFrame(item, api) {
  const s = item.after, bar = $('#status');
  if (!s) { bar.innerHTML = ''; bar.hidden = true; return; }
  bar.hidden = false;
  const sc = scores(s), owner = item.owner ?? s.turn;
  const ops = !s.over && s.turn === owner ? s.ops : 0;
  bar.innerHTML = `
    <span class="st-round">r <b>${item.round ?? s.round}</b>/${MAX_ROUNDS}</span>
    <span class="st-main">main <b>${commitsOnMain(s)}</b>/${RELEASE_AT}</span>
    ${pips(ops, 3, owner)}
    <span class="st-score" aria-label="live score"><b class="you">you ${sc.you.total}</b> · <b class="bot">bot ${sc.bot.total}</b></span>
    <button class="st-table" data-table aria-label="open the table">table</button>`;
  bar.querySelector('[data-table]').onclick = () => openTable(item, api);
}

function tokens(s, id) {
  const p = s.players[id], t = [];
  if (p.merge) t.push(`<span class="tok neg">merge ×${p.merge}</span>`);
  if (p.grudges) t.push(`<span class="tok neg">grudge ×${p.grudges}</span>`);
  if (p.sin) t.push(`<span class="tok neg">sin ×${p.sin}</span>`);
  if (p.blame) t.push(`<span class="tok neg">blame −${p.blame}</span>`);
  if (p.fixes) t.push(`<span class="tok pos">fixes +${p.fixes}</span>`);
  return t.join('') || `<span class="tok none">${TABLE.noTokens}</span>`;
}

function openTable(item, api) {
  const s = item.after, sheet = $('#sheet'), inc = INCIDENT[s.incident];
  const you = s.players.you, bot = s.players.bot;
  api.emit('table', item);
  sheet.innerHTML = `<div class="sheet-card" role="dialog" aria-label="the table">
    <div class="sheet-head"><h2>${TABLE.title}</h2><button data-close class="ghost">${TABLE.close}</button></div>
    ${strip(s)}
    <div class="incident-line"><span class="k">${TABLE.incident}</span> <b>${esc(inc.name)}</b> — ${esc(inc.text)}</div>
    <div class="people">
      <div class="person you"><h3>you</h3>
        <p>${plural(you.hand.length, 'card')} in hand · ${plural(you.staged.length, 'card')} staged · ${plural(you.local.length, 'commit')} to push</p>
        <div class="toks">${tokens(s, 'you')}</div></div>
      <div class="person bot"><h3>bot</h3>
        <p>${plural(bot.hand.length, 'card')} in hand · ${plural(bot.staged.length, 'card')} staged · ${plural(bot.local.length, 'commit')} to push</p>
        <div class="toks">${tokens(s, 'bot')}</div></div>
    </div>
    <p class="fine">${TABLE.fine}</p>
  </div>`;
  sheet.hidden = false;
  scrollStripToTip(sheet);
  const close = () => { sheet.hidden = true; sheet.innerHTML = ''; };
  sheet.querySelector('[data-close]').onclick = close;
  sheet.onclick = ev => { if (ev.target === sheet) close(); };
}
