// The consequence screens (event-screens §3, the O- screens): one moment at a time, the command and Git's output in the
// terminal, the cards it moved, and the coach line. Forward only (§1.6): continue, or skip to your pack.
import { el } from "./dom.js";
import { card, commit } from "./cards.js";
import { lines } from "./transcript.js";

const commits = (view, ids) => ids.map((id) => view.main.find((c) => c.id === id)).filter(Boolean);
const strip = (cs) =>
  cs.length > 0 &&
  el(
    "ol",
    { class: "strip moved" },
    cs.map((c) => el("li", {}, commit(c))),
  );

/** What a moment moved, drawn: the commits it put on main or flipped, the CI's flips, the incident. */
function picture(m, view, you) {
  const e = m.events.at(-1);
  switch (m.kind) {
    case "pushed":
      return strip(commits(view, e.commits));
    case "blamed":
    case "reverted":
      return strip(commits(view, [e.target]));
    case "reflog":
      return strip(commits(view, e.restored));
    case "forced":
      return strip(commits(view, e.pushed));
    case "ci":
      return el(
        "ol",
        { class: "strip ci" },
        m.ci.flips.map((f, i) =>
          el(
            "li",
            { style: `--i: ${i}` },
            el(
              "div",
              { class: `card strip flip ${f.bug ? "bug" : "clean"}` },
              el("span", { class: "big" }, f.bug ? "BUG" : "ok"),
              el("span", { class: "author" }, f.author),
            ),
          ),
        ),
      );
    case "incident": {
      const drew = view.today.find((x) => x.type === "drew" && x.player === you);
      return el(
        "div",
        { class: "incident-card" },
        el("h2", {}, view.incident?.name ?? `day ${m.day}`),
        el("p", {}, view.incident?.text ?? ""),
        el("p", { class: "muted" }, `${view.budget} ops today · up to ${view.max_ops} in a pack`),
        drew?.cards &&
          el(
            "div",
            { class: "cards" },
            drew.cards.map((c) => card(c)),
          ),
      );
    }
    default:
      return null;
  }
}

/** One moment's screen. `step` is `{at, of}` for the progress line; `next` continues, `skip` goes to the hub. */
export function momentScreen(m, { view, you, step, next, skip }) {
  const title = m.kind === "incident" ? `day ${m.day}` : m.kind === "ci" ? "CI" : null;
  return el(
    "section",
    { class: `screen moment ${m.kind}${m.tone ? ` ${m.tone}` : ""}`, "aria-live": "polite" },
    el(
      "p",
      { class: "progress muted" },
      `${step.at} of ${step.of}`,
      m.pack && ` · ${m.player === you ? "your" : `${m.player}'s`} pack`,
    ),
    title ? el("h1", {}, title) : el("div", { class: "transcript" }, lines(m, you, { why: false })),
    picture(m, view, you),
    // the bot thinking out loud (event-screens §5), above what it means for you
    m.why && el("p", { class: "bubble" }, el("span", { class: "who" }, m.player), " ", m.why),
    m.coach && el("p", { class: "coach" }, m.coach),
    el(
      "div",
      { class: "moment-actions" },
      el(
        "button",
        { class: "primary", onclick: next, autofocus: true },
        step.at < step.of ? "continue" : view.released ? "the scores" : "write your pack",
      ),
      step.at < step.of && el("button", { onclick: skip }, "skip to your pack"),
    ),
  );
}
