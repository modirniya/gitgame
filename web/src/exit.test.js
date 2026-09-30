// The Phase 1 exit as a test (docs/design/phase-1-plan.md: "a full game against the bot is played in the browser, and
// replayed from its log"). A whole game against the bot, written through the client's own modules (api.js, pack.js,
// moments.js) and sent to a running remote, then replayed day by day from its log. It runs when GITGAME_REMOTE names a
// remote, as CI's exit job does, and is skipped otherwise:
//   GITGAME_REMOTE=http://localhost:4000 npx vitest run src/exit.test.js
import { describe, expect, it } from "vitest";
import { remote } from "./api.js";
import { actions, add, price } from "./pack.js";
import { moments } from "./moments.js";

const base = process.env.GITGAME_REMOTE;
const BOUNDARIES = ["pack_opened", "pack_closed", "day_closed", "conflict_detected", "conflict_resolved"];

// What a person at the hub would do on an ordinary day: build a commit from their biggest clean card, ship it (the
// editor writes the pull), tag once main is big enough. Only the ops the budget covers now are sent.
function write(view) {
  const clean = view.you.hand.filter((c) => c.kind === "commit" && !c.bug).sort((a, b) => b.lines - a.lines);
  let ops = [];
  if (view.you.staged.length) ops = add(view, ops, { op: "commit", message: "feat: ship it" });
  else if (clean.length) {
    ops = add(view, ops, { op: "add", cards: [clean[0].id] });
    ops = add(view, ops, { op: "commit", message: "feat: ship it" });
  }
  ops = add(view, ops, { op: "push" });
  if (actions(view, ops).tag === null) ops = add(view, ops, { op: "tag" });
  return price(view, ops)
    .rows.filter((r) => r.runs)
    .map((r) => r.op);
}

describe.skipIf(!base)("the Phase 1 exit", () => {
  const api = remote((path, init) => fetch(`${base}${path}`, init));

  it("a full game against the bot, played through the client and replayed from its log", async () => {
    const { id } = await api.createGame({
      seats: ["ana", "bot"],
      bots: ["bot"],
      dayLength: "correspondence",
      seed: 42,
    });

    let view = await api.fetchView(id, "ana");
    for (let day = 0; !view.released && day < 20; day++) {
      await api.sendPack(id, { player: "ana", version: view.version, ops: write(view) });
      view = await api.fetchView(id, "ana");
    }

    expect(view.released).toBeTruthy();
    const log = view.days.flatMap((d) => d.log);
    expect(log.some((e) => e.type === "push_accepted" && e.player === "ana")).toBe(true);

    // every event the remote sent becomes a moment, or is a boundary between them
    for (const d of view.days) {
      const events = d.log.filter((e) => !BOUNDARIES.includes(e.type));
      expect(moments(d.log, { you: "ana" }).moments).toHaveLength(events.length);
    }

    // the replay: each day as the log makes it, and the last day is the game as it ended
    for (let n = 0; n <= view.days.length; n++) {
      const then = await api.fetchDay(id, n, "ana");
      expect(then.days).toEqual(view.days.slice(0, n));
    }
    expect(await api.fetchDay(id, view.days.length, "ana")).toEqual(view);
  }, 60_000);
});
