// The release (event-screens §3, O-CI and O-Scoreboard): CI turning every commit on `main` face-up, the bugs that
// reached production turning red, and the scoreboard, which reads across: one column per seat, one row per part of
// the score. The flips are CSS animations delayed by each card's place on `main` (release.css), not timers, so a screen
// left halfway through leaves nothing running; and a card's resting state is face-up, so with no motion it just is.
import { el } from "./dom.js";
import { commit } from "./cards.js";
import { nudge } from "./whoami.js";
import { whatDecidedIt, winners } from "./verdict.js";

const PARTS = [
  ["lines", "lines on main"],
  ["fixes", "fixes"],
  ["blame", "blame"],
  ["merge", "merge tokens"],
  ["grudges", "grudges"],
  ["sins", "sins"],
];

const count = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
// a printed minus, as wide as a digit, so a column of points lines up
const points = (n) => String(n).replace("-", "−");

/** O-CI for moment `m` (its `ci` is the remote's `ci_ran`): every commit on main after the initial one, in order. */
export function ciGrid(m, view) {
  // which bugs counted is the remote's to say: a bug reverted or crossed out before the release didn't
  const counted = new Set(m.ci.flips.filter((f) => f.bug).map((f) => f.commit));
  const cs = view.main.filter((c) => !c.initial);
  return [
    el(
      "ol",
      { class: "ci-grid" },
      cs.map((c, i) =>
        el("li", { class: counted.has(c.id) ? "counts" : null, style: `--i: ${i}` }, commit(c, { size: "sm" })),
      ),
    ),
    el(
      "p",
      { class: `stamp ${m.ci.bugs ? "bad" : "ok"}`, style: `--n: ${cs.length}` },
      `${count(m.ci.bugs, "bug")} reached production`,
    ),
  ];
}

/**
 * O-Scoreboard: the headline, who won, each part of the score by seat (yours first, as "you"), and what decided it;
 * then `feedback` (the box, for a player who held a seat) and the nudge to keep this device's games.
 */
export function scoreboard(view, me, feedback) {
  const you = view.you?.player ?? null;
  const seats = you ? [you, ...view.seats.filter((id) => id !== you)] : view.seats;
  const { bugs, production_down: down } = view.released;
  const won = winners(view.scores, down);
  const whose = (id) => (id === you ? "you" : "other");
  const row = (key, label) =>
    el(
      "tr",
      {},
      el("th", { scope: "row" }, label),
      seats.map((id) => el("td", {}, points(view.scores[id][key]))),
    );

  return el(
    "section",
    { class: "view scoreboard" },
    el(
      "div",
      { class: "body" },
      el(
        "h1",
        { class: down ? "down" : null },
        down ? `Production is down: ${count(bugs, "bug")}.` : "The release shipped.",
      ),
      el(
        "p",
        { class: `winner ${won.length === 1 ? whose(won[0]) : "draw"}` },
        won.length > 1 ? "A draw." : won[0] === you ? "You win." : `${won[0]} wins.`,
      ),
      el(
        "table",
        { class: "scores" },
        el(
          "thead",
          {},
          el(
            "tr",
            {},
            el("td"),
            seats.map((id) => el("th", { scope: "col", class: whose(id), title: id }, id === you ? "you" : id)),
          ),
        ),
        el(
          "tbody",
          {},
          PARTS.map(([key, label]) => row(key, label)),
        ),
        el("tfoot", {}, row("total", "total")),
      ),
      el("p", { class: "said" }, `What decided it: ${whatDecidedIt(view.scores, down)}`),
      feedback,
      me && nudge(me),
    ),
    el(
      "div",
      { class: "actions" },
      el("a", { class: "button", href: `#/r/${view.id}` }, "replay it"),
      el("a", { class: "button primary", href: "#/" }, "new game"),
    ),
  );
}
