// Your branch as the pack being written would leave it (event-screens §3, I-Hub): where you stand, what is staged,
// and the commits to push, with what the pack pushes waiting at the end of `main`. Each op written changes it at
// once, as the prototype answered each op with its consequence; the day's resolution can still change what lands.
import { el } from "./dom.js";
import { card, commit } from "./cards.js";

const files = (cards) => [...new Set(cards.map((c) => c.file))];

/** One of your commits, face-up to you (bug and all), as it would look on main; one the pack makes has no hash yet. */
export function own(c, you) {
  return {
    id: c.id ?? "new",
    author: you,
    message: c.message,
    files: files(c.cards),
    lines: c.cards.reduce((n, k) => n + k.lines, 0),
    flipped: true,
    bug: c.cards.some((k) => k.bug),
  };
}

/** At the tip, or how far behind, and whether the pack's pull catches you up. */
export function standing(view, ops) {
  const behind = view.players[view.you.player].behind;
  if (!behind) return el("span", { class: "standing ok" }, "at the tip");
  return el(
    "span",
    { class: "standing behind" },
    ops.some((o) => o.op === "pull" || o.op === "force")
      ? `${behind} behind · the pack catches up`
      : `${behind} behind`,
  );
}

function zone(name, label, items) {
  return el(
    "div",
    { class: "zone", "data-zone": name },
    el("span", { class: "k" }, label),
    el("div", { class: "zcards" }, items.length ? items : el("span", { class: "empty" }, "empty")),
  );
}

/** `left` is your side after the pack's ops (`price(view, ops).left`). */
export function branch(view, left, ops) {
  const you = view.you.player;
  return el(
    "section",
    { class: "branch", "aria-label": "your branch" },
    el("header", { class: "branch-head" }, el("span", { class: "k" }, "your branch"), standing(view, ops)),
    el(
      "div",
      { class: "zones" },
      zone(
        "staged",
        "staged",
        left.staged.map((c) => card(c, { size: "sm" })),
      ),
      zone(
        "local",
        "to push",
        left.local.map((c) => commit(own(c, you), { size: "sm", faceUp: true })),
      ),
    ),
  );
}
