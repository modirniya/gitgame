// The animations of spec §4: each one shows the mechanism of what happened, not decoration. A push is a card
// travelling from your branch to the end of main; a rejection is the same trip bouncing back; a pull is your
// pointer sliding to the tip. Card movement uses FLIP — the screen is rendered in its final layout, each moving
// element is measured, sent back to where it came from with a transform, and played forward — so nothing
// animates layout and nothing jumps. prefers-reduced-motion turns every one of them off.

const DUR = 520, EASE = 'cubic-bezier(.2, .8, .2, 1)';
export const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const center = r => [r.left + r.width / 2, r.top + r.height / 2];
const $$ = (el, sel) => [...el.querySelectorAll(sel)];
const later = (ms, f) => setTimeout(f, ms);

// FLIP: play `el` from `rect` (where it was, or where it came from) to where it is now.
function fromRect(el, rect, { delay = 0, duration = DUR, fade = false, scale = true, easing = EASE } = {}) {
  const r = el.getBoundingClientRect(), [x0, y0] = center(rect), [x1, y1] = center(r);
  const k = scale && r.width ? rect.width / r.width : 1;
  return el.animate([{ transform: `translate(${x0 - x1}px, ${y0 - y1}px) scale(${k})`, opacity: fade ? 0 : 1 }, { transform: 'none', opacity: 1 }], { duration, delay, easing, fill: 'backwards' });
}
// A card that crosses containers (from your branch into the scrolling strip) would be clipped by the strip, so a
// copy flies on a fixed layer above the screen and the real card appears when it lands.
const flights = new Set();
function fly(el, rect, opts = {}) {
  const to = el.getBoundingClientRect(), ghost = el.cloneNode(true);
  Object.assign(ghost.style, { position: 'fixed', left: to.left + 'px', top: to.top + 'px', width: to.width + 'px', height: to.height + 'px', margin: 0, zIndex: 50, pointerEvents: 'none' });
  document.body.appendChild(ghost); flights.add(ghost); el.style.visibility = 'hidden';
  fromRect(ghost, rect, { scale: false, ...opts }).finished.catch(() => {}).finally(() => { ghost.remove(); flights.delete(ghost); el.style.visibility = ''; });
}
export function clearFlights() { for (const g of flights) g.remove(); flights.clear(); }
const pop = (el, delay = 0) => el.animate([{ transform: 'scale(.6)', opacity: 0 }, { transform: 'scale(1.06)', opacity: 1, offset: .7 }, { transform: 'none', opacity: 1 }], { duration: 380, delay, easing: EASE, fill: 'backwards' });
const rise = (el, dy, delay = 0) => el.animate([{ transform: `translateY(${dy}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: DUR, delay, easing: EASE, fill: 'backwards' });
// A 3D flip: the card is drawn face-down, then turned (the .flipper transition in styles.css does the turn).
function turn(card, delay) { card.classList.remove('up'); void card.offsetWidth; later(delay, () => card.classList.add('up')); }
const slotCard = (el, id) => el.querySelector(`[data-slot="${id}"] .card`);
const chipIn = (el, id, who) => el.querySelector(`[data-slot="${id}"] [data-ptr="${who}"]`);
const tipChip = (el, who) => $$(el, `[data-ptr="${who}"]`).pop();

// Your pointer (or the bot's) slides from the commit it was on to where it is now.
function slidePointer(el, before, who) {
  const was = before.main[before.players[who].ptr - 1]; if (!was) return;
  const old = el.querySelector(`[data-slot="${was.id}"] .ptrs`), chip = tipChip(el, who);
  if (old && chip && !chipIn(el, was.id, who)) fromRect(chip, old.getBoundingClientRect(), { scale: false, duration: 700, delay: 150, easing: 'ease-in-out' });
}

const BY_SCREEN = {
  'O-Incident': el => $$(el, '[data-anim=deal]').forEach(c => c.animate([{ transform: 'translateY(-60px) rotate(-6deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: DUR, easing: EASE })),
  'O-YourTurn': el => {
    $$(el, '[data-anim=draw]').forEach((c, i) => c.animate([{ transform: 'translateY(260px) rotate(8deg) scale(.7)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: DUR, delay: 120 + i * 140, easing: EASE, fill: 'backwards' }));
    $$(el, '.bigpips i').forEach((p, i) => pop(p, 420 + i * 110));
  },
  'O-Staged': el => $$(el, '[data-anim=stage]').forEach((c, i) => rise(c, 220, i * 90)),
  'O-Committed': el => {
    const commit = el.querySelector('[data-anim=commit]'), target = commit.getBoundingClientRect();
    const parts = $$(el, '[data-anim=stack]');
    parts.forEach((c, i) => {
      const r = c.getBoundingClientRect(), [x0, y0] = center(r), [x1, y1] = center(target);
      c.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${x1 - x0}px, ${y1 - y0}px) scale(1.4)`, opacity: 0 }], { duration: 420, delay: i * 70, easing: EASE, fill: 'forwards' });
    });
    pop(commit, parts.length ? 320 : 0);
  },
  'O-Pushed': (el, { e }) => {
    const zone = el.querySelector('[data-zone=local]').getBoundingClientRect();
    e.commits.forEach((id, i) => { const c = slotCard(el, id); if (c) fly(c, zone, { delay: 80 + i * 120, duration: 620 }); });
  },
  'O-Rejected': el => {
    const tip = el.querySelector('.slot:last-child .card')?.getBoundingClientRect();
    $$(el, '[data-anim=bounce]').forEach(c => {
      const r = c.getBoundingClientRect(), dx = tip ? center(tip)[0] - center(r)[0] : 0, dy = tip ? tip.bottom + 6 - r.top : -120;
      c.animate([{ transform: 'none' }, { transform: `translate(${dx * .9}px, ${dy}px) scale(.8)`, offset: .4 }, { transform: 'translate(0, 0)', offset: .68 },
        { transform: 'translateX(-8px)', offset: .76 }, { transform: 'translateX(8px)', offset: .84 }, { transform: 'translateX(-4px)', offset: .92 }, { transform: 'none' }],
      { duration: 900, delay: 150, easing: 'ease-in-out' });
    });
  },
  'O-Pulled': (el, { before }) => { slidePointer(el, before, 'you'); $$(el, '[data-anim=token] .tok').forEach(t => pop(t, 480)); },
  'I-Conflict': el => {
    const [a, b] = $$(el, '.clash > .labelled'), file = el.querySelector('.clash-file');
    if (!a || !b) return;
    a.animate([{ transform: 'translateX(-70px)' }, { transform: 'translateX(18px)', offset: .55 }, { transform: 'none' }], { duration: 640, easing: EASE });
    b.animate([{ transform: 'translateX(70px)' }, { transform: 'translateX(-18px)', offset: .55 }, { transform: 'none' }], { duration: 640, easing: EASE });
    file.animate([{ opacity: 0, transform: 'scale(.5)' }, { opacity: 1, transform: 'scale(1.35)', offset: .6 }, { opacity: .6, transform: 'scale(1)', offset: .8 }, { opacity: 1, transform: 'none' }], { duration: 900, easing: 'ease-out' });
  },
  'O-Resolved': el => {
    $$(el, '[data-anim=cross]').forEach(c => { c.classList.remove('over'); void c.offsetWidth; later(260, () => c.classList.add('over')); c.animate([{ transform: 'none' }, { transform: 'translateX(-6px)', offset: .3 }, { transform: 'translateX(6px)', offset: .6 }, { transform: 'none' }], { duration: 360, delay: 260 }); });
    $$(el, '[data-anim=drop]').forEach(c => c.animate([{ transform: 'none', opacity: 1, filter: 'none' }, { transform: 'translateY(40px) rotate(8deg)', opacity: .35, filter: 'grayscale(1)' }], { duration: DUR, delay: 200, easing: EASE, fill: 'backwards' }));
  },
  'O-Blamed': el => { const c = el.querySelector('[data-anim=flip]'); turn(c, 250); $$(el, '.stamp').forEach(s => pop(s, 800)); },
  'O-Reverted': el => {
    const [bug, rv] = $$(el, '.revert-stack > .card');
    bug.classList.remove('reverted'); later(560, () => bug.classList.add('reverted'));
    rv.animate([{ transform: 'translateY(-160px) rotate(-10deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: DUR, delay: 120, easing: EASE, fill: 'backwards' });
    $$(el, '.stamp').forEach(s => pop(s, 700));
  },
  'O-Forced': (el, { e }) => {
    const strip = el.querySelector('.strip')?.getBoundingClientRect();
    $$(el, '[data-anim=fall]').forEach((c, i) => {
      const r = c.getBoundingClientRect(), dy = strip ? strip.top + 20 - r.top : -150;
      c.animate([{ transform: `translateY(${dy}px)`, opacity: 1 }, { transform: `translateY(${dy + 30}px) rotate(${i % 2 ? 10 : -10}deg)`, opacity: 1, offset: .3 }, { opacity: .6 }], { duration: 760, delay: 150 + i * 90, easing: 'cubic-bezier(.5, 0, .9, .5)', fill: 'backwards' });
    });
    // the forcer's own commits then land from their side: yours from below, the bot's from above right
    const from = e.player === 'you' ? 'translateY(160px)' : 'translate(50px, -90px) rotate(8deg)';
    e.pushed.forEach((id, i) => { const c = slotCard(el, id); if (c) c.animate([{ transform: from, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: DUR, delay: 750 + i * 100, easing: EASE, fill: 'backwards' }); });
    $$(el, '.stamp').forEach(s => pop(s, 1000));
  },
  'O-Reflog': (el, { e }) => e.restored.forEach((id, i) => { const c = slotCard(el, id); if (c) rise(c, 150, 150 + i * 120); }),
  'O-BotStep': (el, { e, before }) => {
    for (const x of e.events) {
      if (x.type === 'PushAccepted') x.commits.forEach((id, i) => { const c = slotCard(el, id); if (c) c.animate([{ transform: 'translate(40px, -90px) rotate(8deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: DUR, delay: i * 100, easing: EASE, fill: 'backwards' }); });
      if (x.type === 'Pulled') slidePointer(el, before, 'bot');
      if (x.type === 'Blamed') { const c = slotCard(el, x.target); if (c) turn(c, 200); }
      if (x.type === 'Reverted') { const c = slotCard(el, x.revert); if (c) c.animate([{ transform: 'translateY(-90px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: DUR, easing: EASE }); }
      if (x.type === 'ConflictResolved') x.crossedOut.forEach(id => { const c = slotCard(el, id); if (c) { c.classList.remove('over'); later(300, () => c.classList.add('over')); } });
      if (x.type === 'PushRejected') el.querySelector('.bubble')?.animate([{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }], { duration: 300, delay: 200 });
    }
  },
  'O-Behind': el => $$(el, '.slot.mark .card').forEach((c, i) => pop(c, 150 + i * 100)),
  'O-CI': el => {
    const cells = $$(el, '[data-anim=ci]'), step = 250;
    cells.forEach((c, i) => { if (c.classList.contains('up')) turn(c, 300 + i * step); later(300 + i * step + 300, () => c.classList.add('landed')); });
    $$(el, '[data-anim=tally]').forEach(s => pop(s, 300 + cells.length * step + 300));
  },
};

export function animate(el, item) {
  if (reduced()) return;
  try { BY_SCREEN[item.id]?.(el, { e: item.event, s: item.after, before: item.before }); }
  catch (err) { console.warn('animation skipped', item.id, err); } // an animation must never block the game
}
