// A closed day played back with the prototype's rhythm (event-screens §9, M15f). The remote resolves every pack of
// the day at once (ADR-0003), so what the prototype showed op by op as it happened, the client shows when the day
// closes: each step in the order the remote ran it, on the table as that step left it, folded from the table as the
// day opened (`day.opened`) and the day's public events. Everyone else's routine folds into fewer steps (a commit
// built, a pull that changed nothing); your own remote ops each get one; the day ends on its receipt.
import { moments } from "./moments.js";

// The moments that stop the day whoever made them, and wait for a tap.
const BIG = new Set([
  "rejected",
  "conflict",
  "blamed",
  "reverted",
  "forced",
  "reflog",
  "tagged",
  "ci",
  "left",
  "failed",
]);
// What your own pack did that the hub didn't already show you as you wrote it.
const YOURS = new Set(["pushed", "pulled", "push_noop", "skipped"]);
// What someone else's pack did that moves the table, or explains why it didn't move.
const THEIRS = new Set(["committed", "pushed", "pulled", "push_noop"]);

/** The table as `day` opened: `main` and every seat's pointer. */
export function opening(day) {
  const pointers = Object.fromEntries(Object.entries(day.opened.players).map(([id, p]) => [id, p.pointer]));
  return { main: day.opened.main, pointers };
}

// Every commit the reader has seen on main at some point: on it now, or on it as some day opened. A commit a
// force-push erased later is gone from today's main but not from the days it was on.
const seen = new WeakMap();
function known(view) {
  if (!seen.has(view))
    seen.set(
      view,
      new Map([...(view.days ?? []).flatMap((d) => d.opened?.main ?? []), ...view.main].map((c) => [c.id, c])),
    );
  return seen.get(view);
}

// A commit as it was announced when pushed: face-down, whatever later flipped it.
function announced(view, id, author) {
  const c = known(view).get(id);
  if (!c) return { id, author, files: [], lines: "?", flipped: false };
  const { bug, ...rest } = c;
  return { ...rest, flipped: false, overwritten: false, reverted: false };
}

/** The table after one public event: the resolver's moves on `main` and the pointers, and nothing else. */
export function apply(table, e, view) {
  const main = [...table.main];
  const pointers = { ...table.pointers };
  const put = (ids, author) => ids.forEach((id) => main.push(announced(view, id, author)));
  const set = (id, patch) => {
    const i = main.findIndex((c) => c.id === id);
    if (i >= 0) main[i] = { ...main[i], ...patch };
  };

  switch (e.type) {
    case "push_accepted":
      put(e.commits, e.player);
      pointers[e.player] = main.length;
      break;
    case "pulled":
      pointers[e.player] = main.length;
      break;
    // crossed out by a keep-mine: it stays on main, face-up, and no longer counts
    case "conflict_resolved":
      for (const id of e.crossed_out)
        set(id, { overwritten: true, flipped: true, bug: view.main.find((c) => c.id === id)?.bug });
      break;
    case "blamed":
      set(e.target, { flipped: true, bug: e.bug });
      break;
    case "reverted":
      set(e.target, { reverted: true });
      put([e.revert], e.player);
      pointers[e.player] = main.length;
      break;
    // main back to the pusher's pointer, their commits on top; nobody's pointer is past what is left
    case "forced": {
      const kept = main.filter((c) => !e.erased.includes(c.id));
      for (const id of Object.keys(pointers)) pointers[id] = Math.min(pointers[id], kept.length);
      main.splice(0, main.length, ...kept);
      for (const id of e.revived ?? []) set(id, { reverted: false });
      put(e.pushed, e.player);
      pointers[e.player] = main.length;
      break;
    }
    case "reflog_fired":
      for (const id of e.restored) main.push(announced(view, id, e.player));
      pointers[e.player] = main.length;
      break;
  }
  return { main, pointers };
}

function step(m, before, after, { mine, day }) {
  const big = BIG.has(m.kind);
  return {
    kind: "moment",
    moment: m,
    day: day.day,
    before,
    after,
    // the frame shows the score as the day opened: scores are the remote's to count (M15 decision)
    score: day.opened.scores,
    auto: !mine && !big,
    mustSee: big || mine,
    folded: [],
  };
}

/**
 * The steps of `day`, as `you` reads it. `next` is the table the day closed on (the next day's `opened`, or the view
 * itself for the last day): its scores and where you stand end the day's receipt.
 */
export function playback(day, view, { you, next }) {
  const ms = moments(day.log, { you }).moments;
  const steps = [];
  let table = opening(day);
  // routine of someone else's waiting to be folded into their next step: a card staged, a pull that changed nothing
  const waiting = {};

  for (const m of ms) {
    const before = table;
    for (const e of m.events) table = apply(table, e, view);
    const mine = m.player === you;
    const shown = BIG.has(m.kind) || (mine ? YOURS.has(m.kind) : THEIRS.has(m.kind));
    if (!shown) {
      if (!mine && m.player) (waiting[m.player] ??= []).push(m);
      continue;
    }
    const s = step(m, before, table, { mine, day });
    s.folded = waiting[m.player] ?? [];
    delete waiting[m.player];
    steps.push(s);
  }

  // within a pack, which of its shown ops this is: the dots a bot's step counts (event-screens §5)
  for (const s of steps) {
    const own = steps.filter((x) => x.moment.pack && x.moment.pack === s.moment.pack);
    s.of = { at: own.indexOf(s) + 1, of: own.length };
  }

  const order = [...new Set(ms.filter((m) => m.pack).map((m) => m.pack.player))];
  steps.push({
    kind: "summary",
    day: day.day,
    score: next.scores,
    order,
    mine: ms.filter((m) => m.player === you && m.command),
    scores: { before: day.opened.scores, after: next.scores },
    behind: next.players[you]?.behind ?? 0,
    after: table,
    mustSee: true,
    auto: false,
  });
  return steps;
}
