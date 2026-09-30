// The pieces every screen is drawn from: the card (one component at every size, spec §4), the `main` strip with
// its pointers and tip, the ops pips. Pure string builders, so a screen is readable as the HTML it produces.
import { lines, hasBug, commitsOnMain, behindBy, RELEASE_AT } from './engine.js';
import { LABEL } from './copy.js';

export const FILE_COLOR = { 'auth.js': 'var(--f-auth)', 'api.py': 'var(--f-api)', 'styles.css': 'var(--f-css)', Dockerfile: 'var(--f-docker)', 'README.md': 'var(--f-readme)' };
export const WHO = { you: LABEL.you, bot: LABEL.bot };
export const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
export const code = t => `<code>${esc(t)}</code>`;
export const cardLabel = c => c.cmd ? c.cmd : `${c.file} +${c.lines}`;
export const commitLabel = c => c.init ? '' : c.revertOf ? `${LABEL.card.revert} ${c.revertOf}` : c.cards.map(cardLabel).join(' + ');
const attrs = a => Object.entries(a || {}).map(([k, v]) => ` ${k}="${esc(v)}"`).join('');

// A card from a hand: a commit card (file, lines, maybe a bug only its holder sees) or a command card.
export function handCard(c, { size = 'lg', cls = '', data } = {}) {
  if (c.cmd) {
    return `<div class="card cmd ${size} ${cls}" style="--c:var(--cmd)"${attrs(data)}><div class="band">${LABEL.card.command}</div>
      <div class="face"><div class="name">${esc(c.cmd)}</div></div><div class="cost">${c.cmd === 'reflog' ? LABEL.card.reflogCost : LABEL.card.cost(1)}</div></div>`;
  }
  return `<div class="card ${size} ${cls}" style="--c:${FILE_COLOR[c.file]}"${attrs(data)}><div class="band">${LABEL.card.commit}</div>
    <div class="face"><div class="file">${esc(c.file)}</div><div class="lines">+${c.lines}</div></div>${c.bug ? `<div class="bugtag">${LABEL.card.bug}</div>` : ''}</div>`;
}

// A commit: face-down unless it has been flipped (or `faceUp`, for the player's own view of their local branch).
// `reveal` also renders the face of a face-down commit, so a 3D flip can turn one into the other; without it the
// DOM of a face-down commit holds only its hash, and inspecting the page can't give a bug away.
export function commitCard(c, { size = 'md', cls = '', faceUp = false, reveal = false, data } = {}) {
  if (c.init) return `<div class="card init ${size} ${cls}" style="--c:var(--faint)"${attrs(data)}><div class="band">${LABEL.card.main}</div><div class="face"><div class="file">${LABEL.card.initial}</div></div></div>`;
  if (c.revertOf) return `<div class="card cmd revert ${size} ${cls}" style="--c:var(--ok)"${attrs(data)}><div class="band">${LABEL.card.revert}</div><div class="face"><div class="name">${LABEL.card.revert}</div><div class="file">${esc(c.revertOf)}</div></div></div>`;
  const up = c.flipped || faceUp;
  const first = c.cards[0];
  const files = [...new Set(c.cards.map(x => x.file))];
  const state = [c.overwritten ? 'over' : '', c.reverted ? 'reverted' : ''].join(' ');
  return `<div class="card commit ${size} ${cls} ${up ? 'up' : 'down'} ${state}" style="--c:${FILE_COLOR[first.file]}" data-sha="${c.id}"${attrs(data)}><div class="flipper">
    <div class="side back"><span>${esc(c.id.slice(0, 7))}</span></div>
    ${up || reveal ? `<div class="side front"><div class="band">${LABEL.card.commit}</div><div class="face"><div class="file">${files.map(esc).join('<br>')}</div><div class="lines">+${lines(c)}</div></div>${hasBug(c) ? `<div class="bugtag">${c.lazy && !c.cards.some(x => x.bug) ? LABEL.card.lazyBug : LABEL.card.bug}</div>` : ''}</div>` : ''}
  </div></div>`;
}

export const chip = id => `<span class="ptr ${id}" data-ptr="${id}">${WHO[id]}</span>`;

// `main` as a horizontal strip: initial commit at the left, the tip at the right, each slot labelled with what was
// announced (file, lines, author) and the pointers beneath. opts.target marks tappable commits; opts.mark highlights.
export function strip(s, { target = [], mark = [], hide = [], extra = '', wrap = false } = {}) {
  const slots = s.main.map((c, i) => {
    const ptrs = ['you', 'bot'].filter(id => s.players[id].ptr === i + 1).map(chip).join('');
    const who = c.init ? '' : `<b class="${c.author}">${WHO[c.author]}</b> ${esc(c.revertOf ? LABEL.card.revert : commitLabel(c))}`;
    const cls = [target.includes(c.id) ? 'target' : '', mark.includes(c.id) ? 'mark' : '', hide.includes(c.id) ? 'hidden' : ''].join(' ');
    return `<div class="slot ${cls}" data-slot="${c.id}"><div class="tipmark">${i === s.main.length - 1 ? LABEL.strip.tip : ''}</div>${commitCard(c, { size: 'md' })}<div class="who">${who}</div><div class="ptrs">${ptrs}</div></div>`;
  }).join('');
  return `<div class="strip-wrap"><div class="strip-head"><span>${LABEL.strip.main}</span><span>${LABEL.strip.commits(commitsOnMain(s), RELEASE_AT)}</span></div><div class="strip ${wrap ? 'wrap' : ''}" data-strip>${slots}${extra}</div></div>`;
}
// Keep the tip in view: the strip scrolls sideways, the page never does.
export function scrollStripToTip(root) { root.querySelectorAll('[data-strip]').forEach(el => { el.scrollLeft = el.scrollWidth; }); }

export const pips = (ops, max, who) => `<span class="pips ${who}" aria-label="${LABEL.status.ops(ops)}">${Array.from({ length: Math.max(max, ops) }, (_, i) => `<i class="${i < ops ? 'on' : ''}"></i>`).join('')}</span>`;

export function standing(s, id = 'you') {
  const b = behindBy(s, id);
  return b ? `<span class="standing behind">${LABEL.standing.behind(b)}</span>` : `<span class="standing ok">${LABEL.standing.ok}</span>`;
}
