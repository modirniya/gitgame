// The Table (event-screens §3): the shared view, what everyone at the table may see. `main` in full with its tip and
// every pointer, each player's tokens and counts, the incident and the clock. A sheet on phones, a panel beside the
// screen on wide ones (§4); the same element either way, and the CSS decides.
import { el } from "./dom.js";
import { commit } from "./cards.js";

/** `main` as a strip, initial commit at the left, the tip at the right, each seat's pointer under the commit it's at. */
export function strip(view, { onpick, pickable = () => false } = {}) {
  const tip = view.main.length - 1;
  const at = (i) => view.seats.filter((id) => view.players[id].pointer === i + 1 && !view.players[id].left);

  return el(
    "ol",
    { class: "strip", "aria-label": "main" },
    view.main.map((c, i) =>
      el(
        "li",
        {},
        commit(c, {
          tip: i === tip,
          pickable: pickable(c),
          onclick: onpick && pickable(c) ? () => onpick(c) : null,
        }),
        el(
          "span",
          { class: "pointers" },
          at(i).map((id) => el("span", { class: `chip${id === view.you?.player ? " you" : ""}` }, id)),
        ),
      ),
    ),
  );
}

const tokens = (t) =>
  [
    t.merge && `${t.merge} merge`,
    t.grudges && `${t.grudges} grudge`,
    t.sins && `${t.sins} sin`,
    t.blame && `${t.blame} blame`,
    t.fixes && `${t.fixes} fix`,
  ].filter(Boolean);

function seat(view, id) {
  const p = view.players[id];
  const s = view.scores[id];
  const sent = view.sent_today.includes(id);
  const facts = [
    `${p.hand} in hand`,
    p.staged && `${p.staged} staged`,
    p.to_push && `${p.to_push} to push`,
    p.behind ? `${p.behind} behind` : "at the tip",
    ...tokens(p.tokens),
  ].filter(Boolean);

  return el(
    "li",
    { class: `seat${id === view.you?.player ? " you" : ""}${p.left ? " left" : ""}` },
    el("span", { class: "who" }, id),
    el("span", { class: "score" }, s.total),
    el("span", { class: "facts" }, p.left ? "left the company" : facts.join(" · ")),
    // only a day still open has packs in or out; a replay's days, and a finished game, have none
    view.deadline && !p.left && el("span", { class: "sent" }, sent ? "pack sent" : "writing…"),
  );
}

export function table(view) {
  const commits = view.main.length - 1;

  return el(
    "section",
    { class: "table", "aria-label": "the table" },
    el(
      "header",
      {},
      el("span", {}, `day ${view.day}/${view.final_day}`),
      el("span", {}, `main ${commits}/${view.release_at}`),
      view.incident && el("span", { class: "incident", title: view.incident.text }, view.incident.name),
    ),
    strip(view),
    el(
      "ol",
      { class: "seats" },
      view.seats.map((id) => seat(view, id)),
    ),
  );
}
