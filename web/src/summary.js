// A day's receipt (the prototype's O-TurnSummary and O-Behind, as one screen; M15f): the order the remote ran the
// packs in, what each op of yours did, the score the day changed, `main` as the day closed, and where that leaves you:
// at the tip, or behind and what your next pack must do about it. The one thing a skipped day still shows.
import { el } from "./dom.js";
import { asOf, strip } from "./table.js";
import { RECEIPT, SUMMARY } from "./copy.js";

const mark = { ok: "✓", reject: "✗", warn: "!" };

/** `step` is a summary step from playback.js; `last` says whether a screen follows it. */
export function summaryScreen(step, { view, you, next, last }) {
  const delta = (id) => step.scores.after[id].total - step.scores.before[id].total;
  const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "±0");
  const seats = view.seats.filter((id) => step.scores.after[id]);

  return el(
    "section",
    { class: "view summary", "aria-live": "polite" },
    el(
      "div",
      { class: "body" },
      el("h1", {}, `day ${step.day} closed`),
      step.order.length > 1 &&
        el("p", { class: "order k" }, SUMMARY.order(step.order.map((id) => (id === you ? "yours" : `${id}'s`)))),
      el(
        "ol",
        { class: "receipt-list", "aria-label": "your pack" },
        step.mine.length
          ? step.mine.map((m) =>
              el(
                "li",
                { class: m.tone ?? "" },
                el("span", { class: "mark" }, mark[m.tone] ?? "·"),
                el("span", { class: "cmd" }, m.command),
                el("span", { class: "did" }, RECEIPT[m.kind]?.(m) ?? m.notes?.[0] ?? m.output[0] ?? ""),
              ),
            )
          : el("li", { class: "warn" }, el("span", { class: "mark" }, "!"), SUMMARY.empty),
      ),
      el(
        "p",
        { class: "deltas" },
        seats.map((id) =>
          el(
            "span",
            { class: `stamp${id === you ? " you" : ""}${delta(id) < 0 ? " bad" : ""}` },
            `${id === you ? "you" : id} ${signed(delta(id))}`,
          ),
        ),
      ),
      el("div", { class: "scene" }, strip(asOf(view, step.after))),
      you &&
        el(
          "p",
          { class: `said${step.behind ? " warn" : ""}` },
          step.behind ? SUMMARY.behind(step.behind) : SUMMARY.atTip,
        ),
    ),
    el(
      "div",
      { class: "actions" },
      el(
        "button",
        { class: "primary", onclick: next, autofocus: true },
        !last ? "continue" : view.released ? "the scores" : "write your pack",
      ),
    ),
  );
}
