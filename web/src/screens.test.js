// @vitest-environment jsdom
import { expect, it } from "vitest";
import { stepScreen } from "./screens.js";
import { playback } from "./playback.js";
import { view } from "./view.fixture.js";

// One day of `events` played back for ana: the table opens as the fixture's main stood before its tip was pushed.
const day = (events) => ({
  day: 2,
  log: [{ type: "pack_opened", player: events[0].player, budget: 3, ops: events.length }, ...events],
  opened: {
    main: view().main.slice(0, 2),
    players: { ana: { pointer: 2, behind: 0 }, bot: { pointer: 2, behind: 0 } },
    scores: { ana: { total: 7 }, bot: { total: 1 } },
  },
});
const steps = (events, over = {}) => {
  const v = view(over);
  return { v, steps: playback(day(events), v, { you: "ana", next: v }) };
};
const show = (events, over = {}, which = 0) => {
  const { v, steps: ss } = steps(events, over);
  const calls = [];
  const node = stepScreen(ss[which], {
    view: v,
    you: "ana",
    step: { at: which + 1, of: ss.length },
    next: () => calls.push("next"),
    skip: () => calls.push("skip"),
  });
  return { node, calls, steps: ss };
};
const push = {
  type: "push_accepted",
  player: "bot",
  commits: ["15efd4d"],
  message: "   53d8cce..15efd4d  main -> main",
};

it("titles a step with its command, Git's output under it, and the coach line; continue, or skip to the day's end", () => {
  const { node, calls } = show([push]);
  expect(node.querySelector("h1.cmd").textContent).toBe("git push");
  expect(node.querySelector(".transcript").textContent).toBe("   53d8cce..15efd4d  main -> main");
  expect(node.querySelector(".coach").textContent).toMatch(/^bot pushed, so the tip moved/);
  expect(node.querySelector(".progress").textContent).toBe("day 2 · bot's pack");

  const [skip, go] = node.querySelectorAll(".actions button");
  go.click();
  skip.click();
  expect(calls).toEqual(["next", "skip"]);
});

it("draws main as the step left it: a push's commit arrives at the end, from the pusher's side", () => {
  const { node } = show([push]);
  const slots = [...node.querySelectorAll(".scene .strip .slot")];
  expect(slots.map((s) => s.querySelector(".card").dataset.id ?? "init")).toEqual(["init", "53d8cce", "15efd4d"]);
  expect(slots.at(-1).classList.contains("arrive")).toBe(true);
  expect(slots.at(-1).classList.contains("above")).toBe(true);
  // the pusher's pointer is at its commit
  expect(slots.at(-1).querySelector(".pointers").textContent).toBe("bot");
});

it("slides the puller's pointer from where it was to the tip", () => {
  const pulled = {
    type: "pulled",
    player: "ana",
    rebase: false,
    incoming: ["15efd4d"],
    merge_token: false,
    message: "Fast-forward",
  };
  const { node } = show([push, { type: "pack_opened", player: "ana", budget: 3, ops: 1 }, pulled], {}, 1);
  const chip = node.querySelector('.scene [data-seat="ana"]');
  expect(chip.classList.contains("slide")).toBe(true);
  expect(chip.getAttribute("style")).toBe("--from: -1");
});

it("a rejected push knocks your own commit back from the tip", () => {
  const local = [
    {
      id: "x1",
      author: "ana",
      message: "",
      flipped: false,
      cards: [{ id: "c", kind: "commit", file: "auth.js", lines: 4, bug: false }],
    },
  ];
  const rejected = {
    type: "op_failed",
    player: "ana",
    op: "push",
    message: "! [rejected]        main -> main (non-fast-forward)",
  };
  const { node } = show([rejected], { you: { ...view().you, local } });
  expect(node.querySelector(".stage.reject .bouncer [data-id]").dataset.id).toBe("x1");
});

it("a force-push drops what it erased and lands what it pushed", () => {
  const forced = {
    type: "forced",
    player: "bot",
    erased: ["53d8cce"],
    pushed: ["15efd4d"],
    returned: [],
    revived: [],
    message: " + 53d8cce...15efd4d main -> main (forced update)",
  };
  const { node } = show([forced]);
  expect([...node.querySelectorAll(".fallen .card")].map((c) => c.dataset.id)).toEqual(["53d8cce"]);
  const ids = [...node.querySelectorAll(".scene .strip .slot .card")].map((c) => c.dataset.id ?? "init");
  expect(ids).toEqual(["init", "15efd4d"]);
});

it("a blame flips the commit in place, with what it found", () => {
  const blamed = { type: "blamed", player: "bot", author: "ana", target: "53d8cce", bug: true };
  const { node } = show([blamed]);
  expect(node.querySelector(".scene .slot.flipping .card").dataset.id).toBe("53d8cce");
  expect(node.querySelector(".stamp").textContent).toBe("BUG · −3 ana");
});

it("ends the day on its receipt: the order, your ops, the score, and where you stand", () => {
  const mine = [
    { type: "pack_opened", player: "ana", budget: 3, ops: 2 },
    { type: "pull_up_to_date", player: "ana", message: "Already up to date." },
    { type: "op_failed", player: "ana", op: "push", message: "! [rejected]        main -> main (non-fast-forward)" },
  ];
  const { node, steps: ss } = show([push, ...mine], {}, 2);
  expect(ss.at(-1).kind).toBe("summary");
  expect(node.querySelector("h1").textContent).toBe("day 2 closed");
  expect(node.querySelector(".order").textContent).toBe("the remote ran bot's first, then yours");
  expect([...node.querySelectorAll(".receipt-list li")].map((li) => li.textContent)).toEqual([
    "·git pullalready up to date",
    "✗git pushrejected: main had moved",
  ]);
  expect(node.querySelector(".said").textContent).toMatch(/^The tip moved: you are 1 behind/);
});

it("opens a day with the incident, your draws, today's ops, and where you stand", () => {
  const opening = { type: "day_opened", day: 2, incident: "flaky_ci", budget: 3 };
  const today = [
    opening,
    {
      type: "drew",
      player: "ana",
      cards: [
        { id: "d1", kind: "commit", file: "auth.js", lines: 3, bug: false },
        { id: "d2", kind: "command", command: "blame" },
      ],
    },
  ];
  const m = { kind: "incident", player: null, command: null, output: [], tone: "warn", events: [opening], day: 2 };
  const node = stepScreen(
    { kind: "moment", moment: m, day: 2 },
    { view: view({ today }), you: "ana", step: { at: 1, of: 1 }, next() {}, skip() {} },
  );

  expect(node.querySelector("h1").textContent).toBe("day 2 of 12");
  expect(node.querySelector(".incident-card h2").textContent).toBe("Flaky CI");
  // in a day's words: the deck's own text speaks of the tabletop's rounds
  expect(node.querySelector(".incident-card p").textContent).toBe(
    "The day's first push rolls a die: on 1 or 2 it is rejected, and the op is spent.",
  );
  expect([...node.querySelectorAll(".drawn .card")].map((c) => c.dataset.id)).toEqual(["d1", "d2"]);
  expect(node.querySelectorAll(".bigpips .pips i.on")).toHaveLength(3);
  expect(node.querySelector(".said").textContent).toBe("You drew two cards.");
  // ana is one behind in the fixture
  expect(node.querySelector(".then").textContent).toMatch(/^You are 1 behind: a push would be rejected/);
});

it("CI turns the real commits on main, and leads to the scores", () => {
  const flips = [
    { commit: "53d8cce", author: "ana", bug: false, blamed_now: false },
    { commit: "15efd4d", author: "bot", bug: true, blamed_now: true },
  ];
  const ci = { type: "ci_ran", by: "bot", day: 11, bugs: 1, production_down: false, flips };
  const released = { released: { day: 11, bugs: 1, production_down: false } };
  const { v, steps: ss } = steps([ci], released);
  const node = stepScreen(ss[0], { view: v, you: "ana", step: { at: ss.length, of: ss.length }, next() {}, skip() {} });
  expect([...node.querySelectorAll(".ci-grid .card")].map((c) => c.dataset.id)).toEqual(["53d8cce", "15efd4d"]);
  expect(node.querySelector(".stamp").textContent).toBe("1 bug reached production");
  expect(node.querySelector(".actions .primary").textContent).toBe("the scores");
});
