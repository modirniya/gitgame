// The consequence screens (event-screens §3, the O- screens): one moment at a time, the command and Git's output in the
// terminal, the cards it moved, and the coach line. Forward only (§1.6): continue, or skip to your pack.
import { el } from "./dom.js";
import { card, commit } from "./cards.js";
import { lines } from "./transcript.js";

// A commit as the reader may see it: from main, from their own branch, or else face-down, as the table would show a
// commit it can't read (another player's, gone back to their branch).
function find(view, id, author) {
  const own = view.you?.local.find((c) => c.id === id);
  return (
    view.main.find((c) => c.id === id) ??
    (own && {
      id,
      author: own.author,
      files: [...new Set(own.cards.map((k) => k.file))],
      lines: own.cards.reduce((n, k) => n + k.lines, 0),
      flipped: false,
    }) ?? { id, author, files: [], lines: "?", flipped: false }
  );
}

const commits = (view, ids) => ids.map((id) => view.main.find((c) => c.id === id)).filter(Boolean);

// The motions of event-screens §4, as CSS animations keyed by `motion` (styles.css), one card after another (--i);
// prefers-reduced-motion turns them all off.
const strip = (cs, motion = "") =>
  cs.length > 0 &&
  el(
    "ol",
    { class: `strip moved ${motion}` },
    cs.map((c, i) => el("li", { style: `--i: ${i}` }, commit(c))),
  );

/** What a moment moved, drawn: the commits it put on main or flipped, the CI's flips, the incident. */
function picture(m, view, you) {
  const e = m.events.at(-1);
  switch (m.kind) {
    // a push: the commits fly onto the end of main
    case "pushed":
      return strip(commits(view, e.commits), "fly-in");
    // a rejection: the commit flies at the tip and is knocked back
    case "rejected": {
      const tip = view.main.at(-1);
      const mine = m.player === you ? view.you.local.at(-1) : null;
      const bounced = mine
        ? find(view, mine.id, you)
        : { id: "?", author: m.player, files: [], lines: "?", flipped: false };
      return el(
        "div",
        { class: "stage reject" },
        el("div", { class: "tip-card" }, commit(tip, { tip: true })),
        el("div", { class: "bouncer" }, commit(bounced)),
      );
    }
    // a pull: the pointer slides along what came in
    case "pulled": {
      const incoming = commits(view, e.incoming ?? []);
      return (
        incoming.length > 0 &&
        el(
          "div",
          { class: "stage pull", style: `--n: ${incoming.length}` },
          strip(incoming),
          el("span", { class: `chip slider${m.player === you ? " you" : ""}` }, m.player),
        )
      );
    }
    // a conflict: the two commits meet over the file they share
    case "conflict": {
      const c = m.events.find((x) => x.type === "conflict_detected")?.conflicts?.[0];
      if (!c) return null;
      return el(
        "div",
        { class: "stage clash" },
        el("div", { class: "from-left" }, commit(find(view, c.mine, m.player))),
        el("span", { class: "clash-file" }, c.files.join(" ")),
        el("div", { class: "from-right" }, commit(find(view, c.theirs))),
      );
    }
    // blame: the commit flips over
    case "blamed":
      return strip(commits(view, [e.target]), "flip-over");
    // a revert lands on the bug
    case "reverted":
      return strip(commits(view, [e.target, e.revert]), "land");
    // a force-push: what was ahead falls off main, and the pusher's commits land
    case "forced":
      return el(
        "div",
        { class: "stage force" },
        strip(
          e.erased.map((id) => find(view, id)),
          "fall-off",
        ),
        strip(commits(view, e.pushed), "fly-in late"),
      );
    // a reflog: what the force-push erased rises back onto main
    case "reflog":
      return strip(commits(view, e.restored), "rise");
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
