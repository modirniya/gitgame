import { describe, expect, it } from "vitest";
import { guideStep } from "./guide.js";
import { view } from "./view.fixture.js";

// the first day: nothing on main yet, so no one is behind
const day1 = (over = {}) => {
  const v = view({ day: 1, sent_today: [], main: [{ id: "16bb9f2", initial: true }], ...over });
  const ana = { ...v.players.ana, pointer: 1, behind: 0, to_push: 0 };
  return { ...v, players: { ...v.players, ana } };
};
const draft = (ops = [], selected = []) => ({
  ops: ops.map((op) => (op === "add" ? { op, cards: ["k1"] } : { op })),
  selected,
  picking: null,
});

describe("the guided first game", () => {
  it("walks the first day one thing at a time: a card, add, commit, push, send", () => {
    expect(guideStep(day1(), draft())).toMatchObject({ target: "k1" });
    expect(guideStep(day1(), draft([], ["k1"]))).toMatchObject({ target: "add" });
    expect(guideStep(day1(), draft(["add"]))).toMatchObject({ target: "commit" });
    expect(guideStep(day1(), draft(["add", "commit"]))).toMatchObject({ target: "push" });
    expect(guideStep(day1(), draft(["add", "commit", "pull", "push"]))).toMatchObject({ target: "send" });
    expect(guideStep(day1(), draft(["add", "commit", "pull", "push"])).text).toMatch(/pull went in before the push/);
  });

  it("on a two-op day, stops at the commit: a push would not run", () => {
    const short = day1({ budget: 2 });
    expect(guideStep(short, draft(["add"]))).toMatchObject({ target: "commit" });
    for (const ops of [
      ["add", "commit"],
      ["add", "commit", "pull", "push"],
    ]) {
      const step = guideStep(short, draft(ops));
      expect(step.target).toBe("send");
      expect(step.text).toMatch(/Only 2 ops today.*waits on your branch/);
    }
  });

  it("points at a clean card first, never at the bug", () => {
    expect(guideStep(day1(), draft()).target).toBe("k1");
  });

  it("the second day explains what face-down means, then lets go", () => {
    const step = guideStep(view({ day: 2 }), draft());
    expect(step.target).toBeNull();
    expect(step.text).toMatch(/on your own now/);
    expect(guideStep(view({ day: 3 }), draft())).toBeNull();
  });
});
