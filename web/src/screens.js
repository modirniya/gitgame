// The consequence screens (event-screens §3, the O- screens): one moment at a time, the command and Git's output in the
// terminal, the cards it moved, and the coach line. Forward only (§1.6): continue, or skip to your pack.
import { el } from "./dom.js";
import { card, commit } from "./cards.js";
import { pips } from "./frame.js";
import { OPENER } from "./copy.js";

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
    // the day's opener: the incident dealt, your two cards drawn, today's ops
    case "incident": {
      const drew = view.today.find((x) => x.type === "drew" && x.player === you);
      return [
        el(
          "div",
          { class: "incident-card deal" },
          el("span", { class: "band" }, "incident"),
          el("h2", {}, view.incident?.name ?? `day ${m.day}`),
          el("p", {}, view.incident?.text ?? ""),
        ),
        drew?.cards &&
          el(
            "div",
            { class: "drawn" },
            drew.cards.map((c, i) => el("span", { class: "draw", style: `--i: ${i}` }, card(c))),
          ),
        el("div", { class: "bigpips" }, pips(view.budget, view.budget)),
      ];
    }
    default:
      return null;
  }
}

// Git's output under the command, and the game's own remarks as comments (M15a).
function output(m) {
  const out = m.output.filter(Boolean);
  const notes = m.notes ?? [];
  if (!out.length && !notes.length) return null;
  return el(
    "div",
    { class: `transcript${m.tone ? ` ${m.tone}` : ""}` },
    out.map((line) => el("div", { class: "out" }, line)),
    notes.map((note) => el("div", { class: "note" }, `# ${note}`)),
  );
}

// The day's opener says what you drew and where you stand: at the tip, or behind and what that costs your pack.
function opener(view, you) {
  const drew = view.today.find((x) => x.type === "drew" && x.player === you);
  const behind = view.players[you]?.behind ?? 0;
  return [
    drew?.cards && el("p", { class: "said" }, OPENER.drew(drew.cards.length)),
    el("p", { class: `then${behind ? " warn" : ""}` }, behind ? OPENER.behind(behind) : OPENER.atTip),
  ];
}

/** One moment's screen. `step` is `{at, of}` for the progress line; `next` continues, `skip` goes to the hub. */
export function momentScreen(m, { view, you, step, next, skip }) {
  const title =
    m.kind === "incident"
      ? el("h1", {}, `day ${m.day} of ${view.final_day}`)
      : m.kind === "ci"
        ? el("h1", {}, "CI runs")
        : m.command
          ? el("h1", { class: "cmd" }, m.command)
          : el("h1", {}, `${m.player === you ? "you" : m.player} ${m.output.join("; ")}`);
  return el(
    "section",
    {
      class: `view moment ${m.kind}${m.tone ? ` ${m.tone}` : ""}${m.player === you ? " mine" : ""}`,
      "aria-live": "polite",
    },
    el(
      "div",
      { class: "body" },
      el(
        "p",
        { class: "progress muted" },
        `${step.at} of ${step.of}`,
        m.pack && ` · ${m.player === you ? "your" : `${m.player}'s`} pack`,
      ),
      title,
      m.command && output(m),
      el("div", { class: "scene" }, picture(m, view, you)),
      // the bot thinking out loud (event-screens §5), above what it means for you
      m.why && el("p", { class: "bubble" }, el("span", { class: "who" }, m.player), " ", m.why),
      m.kind === "incident" ? opener(view, you) : m.coach && el("p", { class: "said coach" }, m.coach),
    ),
    el(
      "div",
      { class: "actions" },
      step.at < step.of && el("button", { onclick: skip }, "skip to your pack"),
      el(
        "button",
        { class: "primary", onclick: next, autofocus: true },
        step.at < step.of ? "continue" : view.released ? "the scores" : "write your pack",
      ),
    ),
  );
}
