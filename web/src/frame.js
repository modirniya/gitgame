// The frame around every screen of a game (event-screens §3, "Frame"): a thin status bar with the day, `main` against
// the release size, the ops as pips, the live score, and the Table one tap away. A face-down bug counts as clean in
// the score, so it never leaks one (the remote's scores already do).
import { el } from "./dom.js";

/** Ops as pips: `left` filled of `of`, as the prototype counted them, in the color of whose they are. */
export function pips(left, of, whose = "you") {
  return el(
    "span",
    { class: `pips ${whose}`, role: "img", "aria-label": `${left} of ${of} ops left` },
    Array.from({ length: Math.max(of, left) }, (_, i) => el("i", { class: i < left ? "on" : "" })),
  );
}

/**
 * The status bar for `view`. `left` is the ops your pack still leaves today, shown as pips while it is written; the
 * Table button opens the sheet on a phone (on a wide screen the Table is always beside the screen, CSS decides).
 */
export function frame(view, { left = null, tableOpen = false, onTable }) {
  const you = view.you?.player ?? null;
  const others = view.seats.filter((id) => id !== you);

  return el(
    "header",
    { class: "frame" },
    el("span", {}, "day ", el("b", {}, view.day), `/${view.final_day}`),
    el("span", {}, "main ", el("b", {}, view.main.length - 1), `/${view.release_at}`),
    left != null && pips(left, view.budget),
    el(
      "span",
      { class: "score", "aria-label": "the live score" },
      you && el("b", { class: "you" }, `you ${view.scores[you].total}`),
      others.map((id, i) => [i || you ? " · " : "", el("b", {}, `${id} ${view.scores[id].total}`)]),
    ),
    el("button", { class: "table-button", "aria-expanded": String(tableOpen), onclick: onTable }, "table"),
  );
}
