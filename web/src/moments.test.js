import { describe, expect, it } from "vitest";
import { moments } from "./moments.js";
import game from "./game.fixture.json";

// A day as ana reads it: her own pack in full, the bot's as the table sees it (shapes from a real game's log).
const day = [
  { type: "pack_opened", player: "ana", budget: 3, ops: 4 },
  { type: "staged", player: "ana", cards: [{ id: "k47", kind: "commit", file: "Dockerfile", lines: 7, bug: false }] },
  {
    type: "committed",
    player: "ana",
    commit: {
      id: "53d8cce",
      author: "ana",
      message: "build: pin the base image",
      flipped: false,
      cards: [{ id: "k47", kind: "commit", file: "Dockerfile", lines: 7, bug: false }],
    },
  },
  { type: "pull_up_to_date", player: "ana", message: "Already up to date." },
  { type: "push_accepted", player: "ana", commits: ["53d8cce"], message: "   16bb9f2..53d8cce  main -> main" },
  { type: "pack_closed", player: "ana", spent: 3 },
  { type: "pack_opened", player: "bot", budget: 3, ops: 4 },
  { type: "staged", player: "bot", count: 2 },
  { type: "committed", player: "bot", commit: "2887386" },
  {
    type: "conflict_detected",
    player: "bot",
    message: "CONFLICT (content): Merge conflict in styles.css",
    conflicts: [{ files: ["styles.css"], mine: "2887386", theirs: "53d8cce" }],
  },
  { type: "conflict_resolved", player: "bot", strategy: "theirs", crossed_out: [], discarded: ["2887386"] },
  { type: "pulled", player: "bot", rebase: false, incoming: ["53d8cce"], merge_token: false, message: "Fast-forward" },
  { type: "push_up_to_date", player: "bot", message: "Everything up-to-date" },
  { type: "pack_closed", player: "bot", spent: 3 },
  { type: "day_closed", day: 1 },
];

describe("the day log as moments", () => {
  const { moments: ms, seen } = moments(day, { you: "ana" });

  it("makes one moment per op, in order, with each pack's player", () => {
    expect(ms.map((m) => [m.player, m.kind])).toEqual([
      ["ana", "staged"],
      ["ana", "committed"],
      ["ana", "pull_noop"],
      ["ana", "pushed"],
      ["bot", "staged"],
      ["bot", "committed"],
      ["bot", "conflict"],
      ["bot", "push_noop"],
    ]);
    expect(ms[0].pack).toEqual({ player: "ana", budget: 3, ops: 4 });
  });

  it("writes each op as the command a terminal would show, and Git's output under it", () => {
    expect(ms[0].command).toBe("git add Dockerfile");
    expect(ms[1].command).toBe('git commit -m "build: pin the base image"');
    expect(ms[1].output[0]).toBe("[main 53d8cce] build: pin the base image");
    expect(ms[3].output).toEqual(["   16bb9f2..53d8cce  main -> main"]);
  });

  it("shows another player's cards only as counts", () => {
    expect(ms[4]).toMatchObject({ command: "git add", output: ["(2 cards, face-down)"] });
    expect(ms[5]).toMatchObject({ command: "git commit", output: ["[main 2887386]"] });
  });

  it("keeps a conflict with the pull that met it, strategy and all", () => {
    expect(ms[6].command).toBe("git pull -X theirs");
    expect(ms[6].output).toEqual([
      "CONFLICT (content): Merge conflict in styles.css",
      "dropped their 2887386",
      "Fast-forward",
    ]);
    expect(ms[6].tone).toBe("warn");
  });

  it("gives the big moments a screen, and a push its first time only", () => {
    expect(ms.filter((m) => m.screen).map((m) => m.kind)).toEqual(["pushed", "conflict"]);
    expect([...seen].sort()).toEqual(["conflict", "pushed"]);

    const again = moments(day, { you: "ana", seen }).moments;
    expect(again.filter((m) => m.screen).map((m) => m.kind)).toEqual(["conflict"]);
  });

  it("coaches the reader in the second person, and speaks of others by name", () => {
    expect(ms[3].coach).toMatch(/^Your commit is on main/);
    expect(ms[6].coach).toMatch(/^bot hit a conflict/);

    // the reader's own conflict names the strategy that settled it, declared or the default
    expect(moments(day, { you: "bot" }).moments[6].coach).toMatch(/and -X theirs settled it/);

    const asBot = moments(day, { you: "bot" }).moments;
    expect(asBot.find((m) => m.kind === "pushed").coach).toMatch(/^ana pushed, so the tip moved/);
  });
});

describe("the moments that always stop the day", () => {
  const one = (e, you = "ana") => moments([e], { you }).moments[0];

  it("a rejected push, in Git's words", () => {
    const m = one({
      type: "op_failed",
      player: "ana",
      op: "push",
      message: "! [rejected]        main -> main (non-fast-forward)",
    });
    expect(m).toMatchObject({ kind: "rejected", command: "git push", tone: "reject", screen: true });
    expect(m.coach).toMatch(/pull before your push/);
  });

  it("blame that finds a bug in your commit calls your bluff", () => {
    const m = one({ type: "blamed", player: "bot", author: "ana", target: "53d8cce", bug: true });
    expect(m).toMatchObject({ command: "git blame 53d8cce", tone: "reject" });
    expect(m.coach).toBe("bot called your bluff: -3 for you.");
  });

  it("a force-push, and the reflog that answers it", () => {
    const [forced, reflog] = moments(
      [
        {
          type: "forced",
          player: "bot",
          erased: ["0b330b6"],
          pushed: ["9dea397"],
          returned: ["0b330b6"],
          revived: [],
          message: " + c37ef9a...9dea397 main -> main (forced update)",
        },
        { type: "reflog_fired", player: "ana", restored: ["0b330b6"] },
      ],
      { you: "ana" },
    ).moments;

    expect(forced).toMatchObject({ command: "git push --force", tone: "reject", screen: true });
    expect(reflog).toMatchObject({ player: "ana", kind: "reflog", screen: true });
    expect(reflog.coach).toMatch(/^Your trap fired/);
  });

  it("CI at the release, counting what reached production", () => {
    const m = one({ type: "ci_ran", by: "bot", bugs: 3, production_down: true, day: 11, flips: [] });
    expect(m).toMatchObject({ kind: "ci", tone: "reject", screen: true });
    expect(m.coach).toMatch(/production is down/);
  });

  it("an empty pack is a warning; leaving the company stops the day", () => {
    const [empty, left] = moments(
      [
        { type: "empty_pack", player: "raj", in_a_row: 2 },
        { type: "left_the_company", player: "raj" },
      ],
      { you: "ana" },
    ).moments;
    expect(empty).toMatchObject({ tone: "warn", screen: false });
    expect(left).toMatchObject({ tone: "reject", screen: true });
  });

  it("the parts of a pack that aren't ops leave no moment", () => {
    expect(moments([{ type: "day_closed", day: 3 }], { you: "ana" }).moments).toEqual([]);
  });
});

// `game` is a whole bot-vs-bot game (seed 7) as ana read it, from GET /api/games/:id?player=ana. To regenerate after
// the server's events change: create ["ana", "bot"] with both as bots and seed 7, and save {you, days} from ana's view.
// Every event type the resolver makes (grep "type: :" server/lib); the ones that aren't ops only mark boundaries.
const BOUNDARIES = ["pack_opened", "pack_closed", "day_closed", "conflict_detected", "conflict_resolved"];

describe("a whole game", () => {
  let seen = new Set();
  const days = game.days.map((d) => {
    const r = moments(d.log, { you: game.you, seen });
    seen = r.seen;
    return r.moments;
  });
  const all = days.flat();

  it("maps every event to a moment, except the boundaries between them", () => {
    const events = game.days.flatMap((d) => d.log).filter((e) => !BOUNDARIES.includes(e.type));
    expect(all.length).toBe(events.length);
  });

  it("gives every moment something to show, and every screen a coach line", () => {
    for (const m of all) expect(m.command || m.output.length || m.kind === "ci").toBeTruthy();
    for (const m of all.filter((m) => m.screen)) expect(m.coach, m.kind).toBeTruthy();
  });

  it("gives the routine a screen once a game, and the big moments every time", () => {
    const screens = all.filter((m) => m.screen).map((m) => m.kind);
    expect(screens.filter((k) => k === "pushed")).toHaveLength(1);
    expect(screens).toContain("forced");
    expect(screens.at(-1)).toBe("ci");
  });
});
