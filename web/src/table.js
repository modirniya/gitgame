// The Table (event-screens §3): the shared view, what everyone at the table may see. `main` in full with its tip and
// every pointer, the incident, and each player's counts and tokens. A sheet on phones, a panel beside the
// screen on wide ones (§4); the same element either way, and the CSS decides.
import { el } from "./dom.js";
import { commit } from "./cards.js";
import { incidentText } from "./copy.js";

/** The announced log under a commit on `main`: who pushed it, and its files and lines, colored by whose it is. */
export function label(c, view) {
  if (c.initial) return el("span", { class: "who" });
  const mine = c.author === view.you?.player;
  return el(
    "span",
    { class: "who" },
    mine ? el("span", { class: "author you" }, "you") : el("span", { class: "author" }, c.author),
    ` ${c.revert_of ? `revert ${c.revert_of}` : `${(c.files ?? []).join(" ")} +${c.lines}`}`,
  );
}

/**
 * `main` as a strip, initial commit at the left and the tip at the right, marked; each slot labelled with what was
 * announced, and each seat's pointer as a chip under the commit it's at. Only the strip scrolls sideways, and it opens
 * scrolled to the tip. `ghosts` are commits your pack pushes, drawn waiting past the tip: where they land if they do.
 * `pointers` overrides where a seat's chip is drawn.
 */
export function strip(view, { onpick, pickable = () => false, ghosts = [], pointers = {} } = {}) {
  const tip = view.main.length - 1;
  // `pointers` moves a seat's chip to where something else leaves it (the hub: where your pack's pull takes you)
  const pointer = (id) => pointers[id] ?? view.players[id].pointer;
  const at = (i) => view.seats.filter((id) => pointer(id) === i + 1 && !view.players[id].left);

  const list = el(
    "ol",
    { class: "strip", "aria-label": "main" },
    view.main.map((c, i) =>
      el(
        "li",
        { class: "slot" },
        el("span", { class: "tipmark" }, i === tip ? "tip" : ""),
        commit(c, {
          tip: i === tip,
          pickable: pickable(c),
          onclick: onpick && pickable(c) ? () => onpick(c) : null,
        }),
        label(c, view),
        el(
          "span",
          { class: "pointers" },
          at(i).map((id) =>
            id === view.you?.player
              ? el("span", { class: "chip you", title: id, "data-seat": id }, "you")
              : el("span", { class: "chip", title: id, "data-seat": id }, id),
          ),
        ),
      ),
    ),
    ghosts.map((c, i) =>
      el(
        "li",
        { class: "slot ghost" },
        el("span", { class: "tipmark" }, i === 0 ? "your push" : ""),
        commit(c, { faceUp: true }),
        label(c, view),
      ),
    ),
  );
  globalThis.requestAnimationFrame?.(() => (list.scrollLeft = list.scrollWidth));

  return el(
    "section",
    { class: "strip-wrap" },
    el(
      "header",
      { class: "strip-head" },
      el("span", {}, "main"),
      el("span", {}, `${view.main.length - 1}/${view.release_at} commits`),
    ),
    list,
  );
}

// a token's sign is how it scores: every one is a penalty but a fix
const tokens = (t) =>
  [
    t.merge && ["neg", `merge ×${t.merge}`],
    t.grudges && ["neg", `grudge ×${t.grudges}`],
    t.sins && ["neg", `sin ×${t.sins}`],
    t.blame && ["neg", `blame ×${t.blame}`],
    t.fixes && ["pos", `fix ×${t.fixes}`],
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
  ].filter(Boolean);
  const held = tokens(p.tokens);

  return el(
    "li",
    { class: `seat${id === view.you?.player ? " you" : ""}${p.left ? " left" : ""}` },
    el("span", { class: "who" }, id),
    el("span", { class: "score" }, s.total),
    el("span", { class: "facts" }, p.left ? "left the company" : facts.join(" · ")),
    held.length > 0 &&
      el(
        "span",
        { class: "toks" },
        held.map(([sign, text]) => el("span", { class: `tok ${sign}` }, text)),
      ),
    // only a day still open has packs in or out; a replay's days, and a finished game, have none
    view.deadline && !p.left && el("span", { class: "sent" }, sent ? "pack sent" : "writing…"),
  );
}

export function table(view) {
  return el(
    "section",
    { class: "table", "aria-label": "the table" },
    strip(view),
    view.incident &&
      el(
        "p",
        { class: "incident-line" },
        el("span", { class: "k" }, "incident"),
        " ",
        el("b", {}, view.incident.name),
        ` — ${incidentText(view.incident)}`,
      ),
    el(
      "ol",
      { class: "seats" },
      view.seats.map((id) => seat(view, id)),
    ),
  );
}
