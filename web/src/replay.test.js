// @vitest-environment jsdom
import { expect, it } from "vitest";
import { replayScreen } from "./replay.js";
import { view } from "./view.fixture.js";

const day1 = [
  { type: "pack_opened", player: "bot", budget: 3, ops: 1 },
  { type: "push_accepted", player: "bot", commits: ["15efd4d"], message: "   53d8cce..15efd4d  main -> main" },
  { type: "pack_closed", player: "bot", spent: 1 },
];

it("replays a day from the remote's fold of the log, with that day's log as a terminal", async () => {
  const asked = [];
  const now = view({
    you: undefined,
    days: [
      { day: 1, log: day1 },
      { day: 2, log: [] },
    ],
  });
  const remote = {
    fetchView: async () => now,
    fetchDay: async (id, day) => {
      asked.push([id, day]);
      return view({ you: undefined, days: [{ day: 1, log: day1 }] });
    },
  };
  const went = [];
  const screen = replayScreen({ remote, go: (p) => went.push(p), id: "g1", day: 1 });
  await new Promise((r) => setTimeout(r));

  expect(asked).toEqual([["g1", 1]]);
  expect(screen.node.querySelector(".replay-nav span").textContent).toBe("after day 1 of 2");
  expect(screen.node.querySelector(".transcript").textContent).toContain("bot@main $ git push");

  const [back, forward] = screen.node.querySelectorAll(".replay-nav button");
  back.click();
  forward.click();
  expect(went).toEqual(["/r/g1/0", "/r/g1/2"]);
  screen.leave();
});
