// The motions of event-screens §4 between two renders of the same screen: the hub is drawn afresh after every op,
// so a card that is somewhere else afterwards is played from where it was (FLIP: measure, render, invert, play). A
// card into staging, staging into one commit, the commit to "your push" past the tip, your pointer to the tip. Only
// transforms move, so nothing jumps; under prefers-reduced-motion nothing moves at all.

const DURATION = 420;
const EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";

export const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// What moves is what has an identity on the table: a card, a commit, a pointer chip.
const keyed = (root) => [...root.querySelectorAll("[data-id], [data-seat]")];
const key = (node) => (node.dataset.id ? `id:${node.dataset.id}` : `seat:${node.dataset.seat}`);

/** Where everything with an identity is now, to play from after the next render. */
export function snapshot(root) {
  const at = new Map();
  for (const node of keyed(root)) at.set(key(node), { rect: node.getBoundingClientRect(), node });
  return at;
}

function from(node, rect) {
  const now = node.getBoundingClientRect();
  if (!now.width || (Math.abs(now.left - rect.left) < 1 && Math.abs(now.top - rect.top) < 1)) return;
  // end where the stylesheet puts it (a picked card is lifted), not at no transform at all
  const rest = getComputedStyle(node).transform;
  const k = rect.width / now.width;
  node.animate(
    [
      {
        transform: `translate(${rect.left - now.left}px, ${rect.top - now.top}px) scale(${k})${rest === "none" ? "" : ` ${rest}`}`,
        zIndex: 30,
      },
      { transform: rest, zIndex: 30 },
    ],
    { duration: DURATION, easing: EASE },
  );
}

// A card that is gone afterwards and became part of something new (staged cards into a commit) is flown there as a
// copy on a layer above the screen: the original is gone, and a scrolling container would clip it anyway.
function into(old, target) {
  const to = target.getBoundingClientRect();
  const ghost = old.node.cloneNode(true);
  // a copy, not the card: nothing else should take it for the one that moved
  ghost.removeAttribute("data-id");
  Object.assign(ghost.style, {
    position: "fixed",
    left: `${old.rect.left}px`,
    top: `${old.rect.top}px`,
    width: `${old.rect.width}px`,
    height: `${old.rect.height}px`,
    margin: "0",
    zIndex: "40",
    pointerEvents: "none",
  });
  document.body.append(ghost);
  const dx = to.left + to.width / 2 - (old.rect.left + old.rect.width / 2);
  const dy = to.top + to.height / 2 - (old.rect.top + old.rect.height / 2);
  ghost
    .animate([{ transform: "none" }, { transform: `translate(${dx}px, ${dy}px) scale(0.5)`, opacity: 0 }], {
      duration: DURATION,
      easing: EASE,
      fill: "forwards",
    })
    .finished.catch(() => {})
    .finally(() => ghost.remove());
}

const pop = (node, delay = 0) =>
  node.animate(
    [
      { transform: "scale(0.6)", opacity: 0 },
      { transform: "scale(1.06)", opacity: 1, offset: 0.7 },
      { transform: "none", opacity: 1 },
    ],
    { duration: 380, delay, easing: EASE, fill: "backwards" },
  );

/** After a render: everything that moved plays from where it was; what is new pops in, and what was folded into it flies there. */
export function play(root, before) {
  if (reduced() || !before?.size || typeof Element.prototype.animate !== "function") return;
  const after = keyed(root);
  const now = new Set(after.map(key));
  const born = after.filter((node) => !before.has(key(node)) && node.dataset.id);
  const gone = [...before].filter(([k]) => !now.has(k) && k.startsWith("id:")).map(([, old]) => old);

  for (const node of after) {
    const was = before.get(key(node));
    if (was) from(node, was.rect);
  }
  if (born.length && gone.length) for (const old of gone) into(old, born[0]);
  for (const node of born) pop(node, gone.length ? DURATION * 0.6 : 0);
}
