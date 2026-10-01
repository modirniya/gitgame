// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { botHead, says } from "./bot.js";
import { playback } from "./playback.js";
import { stepScreen } from "./screens.js";
import { view } from "./view.fixture.js";

// One day of the bot's pack, played back for ana; the table opens with ana's 53d8cce at the tip.
const day = (events) => ({
  day: 2,
  log: [{ type: "pack_opened", player: "bot", budget: 3, ops: events.length }, ...events],
  opened: {
    main: view().main.slice(0, 2),
    players: { ana: { pointer: 2, behind: 0 }, bot: { pointer: 1, behind: 1 } },
    scores: { ana: { total: 7 }, bot: { total: 1 } },
  },
});
const stepsOf = (events) =>
  playback(day(events), view(), { you: "ana", next: view() }).filter((s) => s.kind === "moment");

describe("what the bot says", () => {
  it("never claims to ship what turned out up to date: its pull dropped the commit", () => {
    const [conflict, noop] = stepsOf([
      {
        type: "conflict_detected",
        player: "bot",
        message: "Auto-merging Dockerfile",
        conflicts: [{ files: ["Dockerfile"], mine: "b1", theirs: "53d8cce" }],
        why: "it pulls first",
      },
      {
        type: "conflict_resolved",
        player: "bot",
        strategy: "theirs",
        crossed_out: [],
        discarded: ["b1"],
        why: "it pulls first",
      },
      {
        type: "pulled",
        player: "bot",
        rebase: false,
        incoming: ["53d8cce"],
        merge_token: false,
        message: "Merge made by the 'ort' strategy.",
        why: "it pulls first",
      },
      {
        type: "push_up_to_date",
        player: "bot",
        message: "Everything up-to-date",
        why: "it ships what it has committed",
      },
    ]);
    expect(says(conflict, { you: "ana" })).toBe(
      "Its commit touched Dockerfile, as yours did, and keeping theirs dropped its own.",
    );
    expect(says(noop, { you: "ana" })).toMatch(/^It meant to ship its commit, but the pull before the push dropped it/);
  });

  it("says how a blame went, and why it chose that commit", () => {
    const [hit] = stepsOf([
      { type: "blamed", player: "bot", author: "ana", target: "53d8cce", bug: true, why: "it blames" },
    ]);
    expect(says(hit, { you: "ana" })).toBe(
      "Your 53d8cce is 7 lines and was face-down: big commits are where bugs hide. It was a bug: −3 to you.",
    );
    const [miss] = stepsOf([
      { type: "blamed", player: "bot", author: "ana", target: "53d8cce", bug: false, why: "it blames" },
    ]);
    expect(says(miss, { you: "ana" })).toMatch(/It was clean: an op and a card spent for nothing\.$/);
  });

  it("counts the cards it built a commit from, folded from its staging", () => {
    const [built] = stepsOf([
      { type: "staged", player: "bot", count: 2, why: "it builds a commit" },
      { type: "committed", player: "bot", commit: "b1", why: "it commits what it staged" },
    ]);
    expect(says(built, { you: "ana" })).toMatch(/^It built a commit of 2 cards/);
  });

  it("blames flaky CI for a rejection CI caused", () => {
    const [flaky] = stepsOf([
      { type: "op_failed", player: "bot", op: "push", message: "CI failed: flaky build (rolled 2)" },
    ]);
    expect(says(flaky, { you: "ana" })).toBe("Flaky CI rolled 2: its push was rejected, and the op is spent.");
  });
});

it("draws the bot with its avatar and its ops as dots, and its bubble instead of its plan's why", () => {
  const steps = stepsOf([
    { type: "staged", player: "bot", count: 1, why: "it builds a commit" },
    { type: "committed", player: "bot", commit: "b1", why: "it commits what it staged" },
    {
      type: "push_accepted",
      player: "bot",
      commits: ["b1"],
      message: "   53d8cce..b1  main -> main",
      why: "it ships what it has committed",
    },
  ]);
  const head = botHead(steps[1]);
  expect(head.querySelector(".avatar").textContent).toBe("bot");
  expect([...head.querySelectorAll(".dots i")].map((i) => i.className)).toEqual(["on", "on"]);

  const node = stepScreen(steps[1], { view: view(), you: "ana", step: { at: 2, of: 3 }, next() {}, skip() {} });
  expect(node.classList.contains("bot")).toBe(true);
  expect(node.querySelector(".bubble").textContent).toBe("It had 1 commit ready, so it shipped: the tip is its now.");
});
