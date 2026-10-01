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
  const { moments: ms } = moments(day, { you: "ana" });

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
    expect(ms[4]).toMatchObject({ command: "git add", output: [], notes: ["2 cards, face-down"] });
    expect(ms[5]).toMatchObject({ command: "git commit", output: ["[main 2887386]"] });
  });

  it("keeps a conflict with the pull that met it, strategy and all", () => {
    expect(ms[6].command).toBe("git pull -X theirs");
    // Git's words come from the remote; what the rule took is the game's remark, a comment
    expect(ms[6].output).toEqual(["CONFLICT (content): Merge conflict in styles.css", "Fast-forward"]);
    expect(ms[6].notes).toEqual(["keep theirs: their 2887386 is gone"]);
    expect(ms[6].tone).toBe("warn");
  });

  it("spells a strategy as Git does, which swaps ours and theirs under --rebase", () => {
    const pull = (strategy, rebase) =>
      moments(
        [
          { type: "conflict_detected", player: "ana", message: "Auto-merging api.py", conflicts: [] },
          { type: "conflict_resolved", player: "ana", strategy, crossed_out: [], discarded: [] },
          { type: "pulled", player: "ana", rebase, incoming: [], merge_token: false, message: "Merge" },
        ],
        { you: "ana" },
      ).moments[0].command;
    expect(pull("theirs", false)).toBe("git pull -X theirs");
    expect(pull("theirs", true)).toBe("git pull --rebase -X ours");
    expect(pull("ours", true)).toBe("git pull --rebase -X theirs");
    expect(pull("resolve", false)).toBe("git pull");
  });

  it("prints no empty line for a rebase that Git settled without a word at the clash", () => {
    const [m] = moments(
      [
        { type: "conflict_detected", player: "ana", message: "", conflicts: [] },
        { type: "conflict_resolved", player: "ana", strategy: "ours", crossed_out: ["15efd4d"], discarded: [] },
        {
          type: "pulled",
          player: "ana",
          rebase: true,
          incoming: [],
          merge_token: false,
          message: "Successfully rebased and updated refs/heads/main.",
        },
      ],
      { you: "ana" },
    ).moments;
    expect(m.output).toEqual(["Successfully rebased and updated refs/heads/main."]);
  });

  it("coaches the reader in the second person, and speaks of others by name", () => {
    expect(ms[3].coach).toMatch(/^Your commit is on main/);
    expect(ms[6].coach).toBe("bot's commit lost the clash: its lines are gone, and main is as it was.");

    // the reader's own conflict names the strategy that settled it, declared or the default
    expect(moments(day, { you: "bot" }).moments[6].coach).toMatch(/keeping theirs dropped yours/);

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
    expect(m).toMatchObject({ kind: "rejected", command: "git push", tone: "reject" });
    expect(m.coach).toMatch(/pull before your push/);
  });

  it("a failed command names its target", () => {
    const m = one({ type: "op_failed", player: "bot", op: "blame", target: "0c10117", message: "fatal: gone" });
    expect(m.command).toBe("git blame 0c10117");
  });

  it("blame that finds a bug in your commit calls your bluff", () => {
    const m = one({ type: "blamed", player: "bot", author: "ana", target: "53d8cce", bug: true });
    expect(m).toMatchObject({ command: "git blame 53d8cce", tone: "reject", output: [] });
    // the verdict is the game's: Git's blame annotates lines and judges nothing
    expect(m.notes).toEqual(["BUG in 53d8cce: ana takes the blame"]);
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

    expect(forced).toMatchObject({ command: "git push --force", tone: "reject" });
    expect(forced.output).toEqual([" + c37ef9a...9dea397 main -> main (forced update)"]);
    expect(forced.notes).toEqual(["erased 0b330b6"]);
    expect(reflog).toMatchObject({ player: "ana", kind: "reflog", output: [] });
    expect(reflog.notes).toEqual(["restored 0b330b6: back on top of main"]);
    expect(reflog.coach).toMatch(/^Your trap fired/);
  });

  it("CI at the release, counting what reached production", () => {
    const m = one({ type: "ci_ran", by: "bot", bugs: 3, production_down: true, day: 11, flips: [] });
    expect(m).toMatchObject({ kind: "ci", tone: "reject" });
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
    expect(empty).toMatchObject({ tone: "warn" });
    expect(left).toMatchObject({ tone: "reject" });
  });

  it("the parts of a pack that aren't ops leave no moment", () => {
    expect(moments([{ type: "day_closed", day: 3 }], { you: "ana" }).moments).toEqual([]);
  });
});

// `game` is a whole bot-vs-bot game (seed 7) as ana read it. To regenerate after the server's events change, from
// server/: create ["ana", "bot"] with both as bots and seed 7 (`GitGame.Games.create(["ana", "bot"], seed: 7, bots:
// ["ana", "bot"])`, which plays itself to the release), and save {you, seats, days, main, players, scores, released}
// from `GitGame.Games.View.for_player(state, id, "ana")` as JSON.
// Every event type the resolver makes (grep "type: :" server/lib); the ones that aren't ops only mark boundaries.
const BOUNDARIES = ["pack_opened", "pack_closed", "day_closed", "conflict_detected", "conflict_resolved"];

describe("a whole game", () => {
  const all = game.days.flatMap((d) => moments(d.log, { you: game.you }).moments);

  it("maps every event to a moment, except the boundaries between them", () => {
    const events = game.days.flatMap((d) => d.log).filter((e) => !BOUNDARIES.includes(e.type));
    expect(all.length).toBe(events.length);
  });

  it("gives every moment something to show, and every moment that moves main a coach line", () => {
    for (const m of all) expect(m.command || m.output.length || m.kind === "ci").toBeTruthy();
    const moves = [
      "pushed",
      "pulled",
      "conflict",
      "rejected",
      "blamed",
      "reverted",
      "forced",
      "reflog",
      "tagged",
      "ci",
    ];
    for (const m of all.filter((m) => moves.includes(m.kind))) expect(m.coach, m.kind).toBeTruthy();
  });
});

it("carries the bot's reasoning with each of its ops (M14b)", () => {
  const ms = moments(
    [
      { type: "pack_opened", player: "bot", budget: 3, ops: 2 },
      { type: "committed", player: "bot", commit: "2887386", why: "it commits what it staged" },
      { type: "push_accepted", player: "bot", commits: ["2887386"], message: "   a..b  main -> main", why: "it ships" },
    ],
    { you: "ana" },
  ).moments;
  expect(ms.map((m) => m.why)).toEqual(["it commits what it staged", "it ships"]);
});
