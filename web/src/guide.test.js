import { describe, expect, it } from "vitest";
import { guideStep } from "./guide.js";
import { view } from "./view.fixture.js";

const day1 = (over = {}) => view({ day: 1, sent_today: [], ...over });
const draft = (ops = [], selected = []) => ({ ops: ops.map((op) => ({ op })), selected, picking: null });

describe("the guided first game", () => {
  it("walks the first day one thing at a time: a card, add, commit, push, send", () => {
    expect(guideStep(day1(), draft())).toMatchObject({ target: "k1" });
    expect(guideStep(day1(), draft([], ["k1"]))).toMatchObject({ target: "add" });
    expect(guideStep(day1(), draft(["add"]))).toMatchObject({ target: "commit" });
    expect(guideStep(day1(), draft(["add", "commit"]))).toMatchObject({ target: "push" });
    expect(guideStep(day1(), draft(["add", "commit", "pull", "push"]))).toMatchObject({ target: "send" });
    expect(guideStep(day1(), draft(["add", "commit", "pull", "push"])).text).toMatch(/pull went in before the push/);
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
