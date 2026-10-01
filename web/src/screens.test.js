// @vitest-environment jsdom
import { expect, it } from "vitest";
import { momentScreen } from "./screens.js";
import { moments } from "./moments.js";
import { view } from "./view.fixture.js";

it("shows a moment's command and output, the commit it moved, and the coach line; continue and skip", () => {
  const push = {
    type: "push_accepted",
    player: "bot",
    commits: ["15efd4d"],
    message: "   53d8cce..15efd4d  main -> main",
  };
  const [m] = moments([{ type: "pack_opened", player: "bot", budget: 3, ops: 2 }, push], { you: "ana" }).moments;
  const calls = [];
  const node = momentScreen(m, {
    view: view(),
    you: "ana",
    step: { at: 1, of: 3 },
    next: () => calls.push("next"),
    skip: () => calls.push("skip"),
  });

  expect(node.querySelector("h1.cmd").textContent).toBe("git push");
  expect(node.querySelector(".transcript").textContent).toBe("   53d8cce..15efd4d  main -> main");
  expect(node.querySelector('.moved [data-id="15efd4d"]')).not.toBeNull();
  expect(node.querySelector(".coach").textContent).toMatch(/^bot pushed, so the tip moved/);
  expect(node.querySelector(".progress").textContent).toBe("1 of 3 · bot's pack");

  // the answer at the thumb, skipping beside it (event-screens §4)
  const [skip, go] = node.querySelectorAll(".actions button");
  go.click();
  skip.click();
  expect(calls).toEqual(["next", "skip"]);
});

// M14c: what each moment draws, and moves (the motion itself is CSS, keyed by these classes)
const screen = (events, you = "ana", over = {}) => {
  const [m] = moments([{ type: "pack_opened", player: events[0].player, budget: 3, ops: 1 }, ...events], {
    you,
  }).moments;
  return momentScreen(m, { view: view(over), you, step: { at: 1, of: 1 }, next() {}, skip() {} });
};

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
  const node = screen(
    [{ type: "op_failed", player: "ana", op: "push", message: "! [rejected]        main -> main (non-fast-forward)" }],
    "ana",
    {
      you: { ...view().you, local },
    },
  );
  expect(node.querySelector(".stage.reject .tip-card [data-id]").dataset.id).toBe("15efd4d");
  expect(node.querySelector(".stage.reject .bouncer [data-id]").dataset.id).toBe("x1");
});

it("a force-push drops what it erased, face-down where the reader can't see it, and lands what it pushed", () => {
  const node = screen([
    {
      type: "forced",
      player: "bot",
      erased: ["53d8cce", "gone1"],
      pushed: ["15efd4d"],
      returned: [],
      revived: [],
      message: " + a...b main -> main (forced update)",
    },
  ]);
  const fell = [...node.querySelectorAll(".fall-off .card")];
  expect(fell.map((c) => c.dataset.id)).toEqual(["53d8cce", "gone1"]);
  expect(fell[1].classList.contains("down")).toBe(true);
  expect(node.querySelector(".fly-in [data-id]").dataset.id).toBe("15efd4d");
});

it("a conflict brings the two commits together over the file they share", () => {
  const node = screen([
    {
      type: "conflict_detected",
      player: "bot",
      message: "CONFLICT (content): Merge conflict in README.md",
      conflicts: [{ files: ["README.md"], mine: "hidden", theirs: "15efd4d" }],
    },
    { type: "conflict_resolved", player: "bot", strategy: "theirs", crossed_out: [], discarded: ["hidden"] },
    {
      type: "pulled",
      player: "bot",
      rebase: false,
      incoming: ["15efd4d"],
      merge_token: false,
      message: "Fast-forward",
    },
  ]);
  expect(node.querySelector(".clash-file").textContent).toBe("README.md");
  expect(node.querySelector(".from-right [data-id]").dataset.id).toBe("15efd4d");
  expect(node.querySelector(".from-left .card").classList.contains("down")).toBe(true);
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
  const node = momentScreen(m, { view: view({ today }), you: "ana", step: { at: 1, of: 1 }, next() {}, skip() {} });

  expect(node.querySelector("h1").textContent).toBe("day 2 of 12");
  expect(node.querySelector(".incident-card h2").textContent).toBe("Flaky CI");
  expect([...node.querySelectorAll(".drawn .card")].map((c) => c.dataset.id)).toEqual(["d1", "d2"]);
  expect(node.querySelectorAll(".bigpips .pips i.on")).toHaveLength(3);
  expect(node.querySelector(".said").textContent).toBe("You drew two cards.");
  // ana is one behind in the fixture
  expect(node.querySelector(".then").textContent).toMatch(/^You are 1 behind: a push would be rejected/);
});
