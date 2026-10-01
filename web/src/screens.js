// The screens of a day played back (event-screens §3, the O- screens; M15f): one step at a time, titled with its
// command, Git's output under it, `main` as the step left it with the step's motion on it (event-screens §4), and one
// sentence of what it means. Forward only (§1.6): continue, or skip to the end of the day.
import { el } from "./dom.js";
import { card, commit } from "./cards.js";
import { pips } from "./frame.js";
import { asOf, strip } from "./table.js";
import { ciGrid } from "./release.js";
import { incidentText, OPENER } from "./copy.js";
import { summaryScreen } from "./summary.js";

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

/** What a step moved, drawn on the table as it stood: the commits that arrived, flipped or fell, the pointer that slid. */
function scene(step, view, you) {
  const m = step.moment;
  const e = m.events.at(-1);
  const after = step.after && asOf(view, step.after);
  const from = m.player === you ? "below" : "above";
  const slide = { seat: m.player, from: step.before?.pointers[m.player] };

  switch (m.kind) {
    case "pushed":
      return strip(after, { motion: { arrive: e.commits, from } });
    // the commit flies at the tip and is knocked back: main as it was, which the push didn't change
    case "rejected": {
      const mine = m.player === you ? view.you.local.at(-1) : null;
      const bounced = mine ? find(view, mine.id, you) : { id: "?", author: m.player, files: [], lines: "?" };
      return [strip(after), el("div", { class: "stage reject" }, el("div", { class: "bouncer" }, commit(bounced)))];
    }
    case "pulled":
      return strip(after, { motion: { slide } });
    // the two commits meet over the file they share, and the pointer still comes to the tip
    case "conflict": {
      const c = m.events.find((x) => x.type === "conflict_detected")?.conflicts?.[0];
      return [
        strip(after, { motion: { slide } }),
        c &&
          el(
            "div",
            { class: "stage clash" },
            el("div", { class: "from-left" }, commit(find(view, c.mine, m.player))),
            el("span", { class: "clash-file" }, c.files.join(" ")),
            el("div", { class: "from-right" }, commit(find(view, c.theirs))),
          ),
      ];
    }
    case "blamed":
      return [
        strip(after, { motion: { flip: [e.target] } }),
        el("span", { class: `stamp ${e.bug ? "bad" : "ok"}` }, e.bug ? `BUG · −3 ${e.author}` : "clean"),
      ];
    case "reverted":
      return strip(after, { motion: { arrive: [e.revert], from } });
    // what was ahead falls off main, and the pusher's commits land
    case "forced":
      return [
        strip(after, { motion: { arrive: e.pushed, from } }),
        e.erased.length > 0 &&
          el(
            "ol",
            { class: "fallen" },
            e.erased.map((id, i) => el("li", { style: `--i: ${i}` }, commit(find(view, id)))),
          ),
      ];
    case "reflog":
      return strip(after, { motion: { arrive: e.restored, from: "below" } });
    // someone else's commit is on their branch now, face-down: nobody sees it until it is pushed
    case "committed":
      return [
        strip(after),
        el(
          "div",
          { class: "their-branch" },
          commit({ id: e.commit, author: m.player, files: [], lines: "?", flipped: false }, { size: "sm" }),
          el("span", { class: "k" }, `${m.player}'s branch`),
        ),
      ];
    case "ci":
      return ciGrid(m, view);
    case "incident": {
      const drew = view.today.find((x) => x.type === "drew" && x.player === you);
      return [
        el(
          "div",
          { class: "incident-card deal" },
          el("span", { class: "band" }, "incident"),
          el("h2", {}, view.incident?.name ?? `day ${m.day}`),
          el("p", {}, view.incident ? incidentText(view.incident) : ""),
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
      return after && strip(after);
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

function title(m, view, you) {
  if (m.kind === "incident") return el("h1", {}, `day ${m.day} of ${view.final_day}`);
  if (m.kind === "ci") return el("h1", {}, "CI runs");
  if (m.command) return el("h1", { class: "cmd" }, m.command);
  return el("h1", {}, `${m.player === you ? "you" : m.player} ${m.output.join("; ")}`);
}

/**
 * One step of the days you haven't seen: a moment, a day's receipt, or today's opener. `step` is `{at, of}` for the
 * progress line; `next` continues, `skip` goes on to the end of the day.
 */
export function stepScreen(s, { view, you, step, next, skip }) {
  const last = step.at >= step.of;
  if (s.kind === "summary") return summaryScreen(s, { view, you, next, last });

  const m = s.moment;
  const whose = m.pack && (m.player === you ? "your pack" : `${m.player}'s pack`);
  return el(
    "section",
    {
      class: `view moment ${m.kind}${m.tone ? ` ${m.tone}` : ""}${m.player === you ? " mine" : ""}${s.auto ? " auto" : ""}`,
      "aria-live": "polite",
    },
    el(
      "div",
      { class: "body" },
      el(
        "p",
        { class: "progress muted" },
        [s.day && m.kind !== "incident" && `day ${s.day}`, whose].filter(Boolean).join(" · "),
      ),
      title(m, view, you),
      m.command && output(m),
      el("div", { class: "scene" }, scene(s, view, you)),
      // the bot thinking out loud (event-screens §5), above what it means for you
      m.why && el("p", { class: "bubble" }, el("span", { class: "who" }, m.player), " ", m.why),
      m.kind === "incident" ? opener(view, you) : m.coach && el("p", { class: "said coach" }, m.coach),
    ),
    el(
      "div",
      { class: "actions" },
      !last && el("button", { onclick: skip }, "skip to the day's end"),
      el(
        "button",
        { class: "primary", onclick: next, autofocus: true },
        !last ? "continue" : view.released ? "the scores" : "write your pack",
      ),
    ),
  );
}
