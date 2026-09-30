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

  expect(node.querySelector(".transcript").textContent).toBe("bot@main $ git push   53d8cce..15efd4d  main -> main");
  expect(node.querySelector('.moved [data-id="15efd4d"]')).not.toBeNull();
  expect(node.querySelector(".coach").textContent).toMatch(/^bot pushed, so the tip moved/);
  expect(node.querySelector(".progress").textContent).toBe("1 of 3 · bot's pack");

  const [go, skip] = node.querySelectorAll("button");
  go.click();
  skip.click();
  expect(calls).toEqual(["next", "skip"]);
});
