// The event-to-screen mapper (event-screens §2): a day log, as the remote sends it to one reader, becomes moments.
// A moment is one op as a terminal would show it: the prompt, the command, Git's output, and a coach line. The events
// an op makes stay together: a pull that hit a conflict is one moment, CONFLICT line and all.
//
// Some moments get a screen of their own, the rest are lines in the transcript. The mobile prototype found one screen
// per event clear for the big moments and slow for the routine (event-screens §8), so: a rejection, a conflict, blame,
// a force-push, a reflog, the tag, CI and someone leaving always get one; a push and a pull get one the first time
// each happens in a game; everything else is a line.
import { coach } from "./copy.js";
import { commandName } from "./cards.js";
import { gitFlag, STRATEGIES } from "./pack.js";

const ALWAYS = new Set([
  "rejected",
  "conflict",
  "blamed",
  "reverted",
  "forced",
  "reflog",
  "tagged",
  "ci",
  "left",
  "incident",
]);
const FIRST_TIME = new Set(["pushed", "pulled"]);

/**
 * `log` is a day's events as `you` may see them. `seen` is the kinds this reader has already had a screen for in this
 * game; the moments that give a kind its first screen add it to the returned `seen`.
 */
export function moments(log, { you, seen = new Set(), bots = [] } = {}) {
  seen = new Set(seen);
  const out = [];
  let pack = null;
  let held = [];

  for (const e of log) {
    if (e.type === "pack_opened") {
      pack = { player: e.player, budget: e.budget, ops: e.ops };
      continue;
    }
    if (e.type === "pack_closed") {
      pack = null;
      continue;
    }
    // a conflict is part of the pull that meets it; hold it until the pull's own event arrives
    if (e.type === "conflict_detected" || e.type === "conflict_resolved") {
      held.push(e);
      continue;
    }

    const m = moment(held.length ? [...held, e] : [e], you);
    held = [];
    if (!m) continue;

    m.pack = pack;
    m.coach = coach(m, you);
    // a bot says why it played each op (M14b), in words anyone at the table may read
    m.why = m.events.findLast((x) => x.why)?.why ?? null;
    m.screen = ALWAYS.has(m.kind) || (FIRST_TIME.has(m.kind) && !seen.has(m.kind));
    if (m.screen) seen.add(m.kind);
    // The bot is a character (event-screens §5): each of its ops is a step on screen, with its reasoning, except
    // staging, which folds into the commit it makes (the prototype's finding: "it staged a card" shows nothing).
    if (bots.includes(m.player) && m.kind !== "staged" && m.kind !== "armed") {
      m.screen = true;
      m.bot = !ALWAYS.has(m.kind);
    }
    out.push(m);
  }

  return { moments: out, seen };
}

const cards = (cs) => cs.map((c) => (c.kind === "command" ? commandName(c.command) : `${c.file} +${c.lines}`));
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function moment(events, you) {
  const e = events.at(-1);
  const who = e.player;
  // `notes` are the game's own remarks, printed as comments: Git never says what a rule took from you
  const m = (kind, command, output = [], tone = null, notes = []) => ({
    kind,
    player: who,
    command,
    output,
    tone,
    notes,
    events,
  });

  switch (e.type) {
    case "day_opened":
      return { kind: "incident", player: null, command: null, output: [], tone: "warn", events, day: e.day };

    case "drew":
      return m("drew", null, [e.cards ? `drew ${cards(e.cards).join(", ")}` : `drew ${plural(e.count, "card")}`]);

    case "staged":
      return e.cards
        ? m("staged", `git add ${[...new Set(e.cards.map((c) => c.file))].join(" ")}`)
        : m("staged", "git add", [`(${plural(e.count, "card")}, face-down)`]);

    case "committed": {
      const c = e.commit;
      if (typeof c === "string") return m("committed", "git commit", [`[main ${c}]`]);
      const lines = c.cards.reduce((n, k) => n + k.lines, 0);
      return m("committed", `git commit -m ${JSON.stringify(c.message || "")}`, [
        `[main ${c.id}] ${c.message}`,
        ` ${plural(c.cards.length, "card")}, +${lines} lines${c.cards.some((k) => k.bug) ? ", one of them a bug" : ""}`,
      ]);
    }

    case "pull_up_to_date":
      return m("pull_noop", "git pull", [e.message]);

    case "pulled": {
      const conflict = events.find((x) => x.type === "conflict_detected");
      const resolved = events.find((x) => x.type === "conflict_resolved");
      const flag = [e.rebase && "--rebase", resolved && gitFlag(resolved.strategy, e.rebase)].filter(Boolean).join(" ");
      const output = [...(conflict ? conflict.message.split("\n") : []), ...e.message.split("\n")];
      const notes = [
        ...(resolved ? resolution(resolved, who === you) : []),
        ...(e.merge_token ? ["a merge token: -1 at the release"] : []),
      ];
      return m(
        conflict ? "conflict" : "pulled",
        `git pull${flag ? ` ${flag}` : ""}`,
        output,
        conflict ? "warn" : null,
        notes,
      );
    }

    case "push_accepted":
      return m("pushed", "git push", [e.message], "ok");

    case "push_up_to_date":
      return m("push_noop", "git push", [e.message]);

    case "blamed":
      return m(
        "blamed",
        `git blame ${e.target}`,
        [e.bug ? `BUG in ${e.target}: ${e.author} takes the blame` : `${e.target} is clean`],
        e.bug ? "reject" : null,
      );

    case "reverted":
      return m("reverted", `git revert ${e.target}`, [e.message], "ok");

    case "forced":
      return m("forced", "git push --force", [e.message], "reject", [
        e.erased.length ? `erased ${e.erased.join(" ")}` : "nothing was ahead to erase",
      ]);

    case "reflog_fired":
      return m("reflog", "git reflog", [`restored ${e.restored.join(" ")}: back on top of main`], "ok");

    case "armed":
      return m("armed", null, [`${commandName(e.trap)} armed, face-down`]);

    case "tagged":
      return m("tagged", e.message, [], "ok");

    case "ci_ran":
      return {
        kind: "ci",
        player: e.by ?? null,
        command: null,
        output: [],
        tone: e.production_down ? "reject" : "ok",
        events,
        ci: e,
      };

    case "op_failed":
      return m(
        e.op === "push" ? "rejected" : "failed",
        `git ${e.op}${e.target ? ` ${e.target}` : ""}`,
        [e.message ?? "failed"],
        "reject",
      );

    case "op_skipped":
      return m("skipped", `git ${e.op}`, [e.message], "warn");

    case "hand_limit":
      return m("hand_limit", null, [
        e.discarded ? `discarded ${cards(e.discarded).join(", ")}` : `discarded ${plural(e.count, "card")}`,
      ]);

    case "empty_pack":
      return m("empty", null, ["sent no pack today"], "warn");

    case "left_the_company":
      return m("left", null, ["left the company"], "reject");

    default:
      return null;
  }
}

function resolution(r, mine) {
  const lines = [];
  if (r.discarded.length)
    lines.push(`${STRATEGIES.theirs}: ${mine ? "your" : "their"} ${r.discarded.join(" ")} is gone`);
  if (r.crossed_out.length) lines.push(`${STRATEGIES.ours}: ${r.crossed_out.join(" ")} crossed out on main, a grudge`);
  if (!lines.length) lines.push(`${STRATEGIES.resolve}: both kept, for an extra op`);
  return lines;
}
