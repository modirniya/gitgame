// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { guideLayer, guideOnStep, guideStep } from "./guide.js";
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
    expect(guideStep(day1(), draft())).toMatchObject({ id: "pick", target: "k1", n: 1, of: 10 });
    expect(guideStep(day1(), draft([], ["k1"]))).toMatchObject({ id: "add", target: "add" });
    expect(guideStep(day1(), draft(["add"]))).toMatchObject({ id: "commit", target: "commit" });
    expect(guideStep(day1(), draft(["add", "commit"]))).toMatchObject({ id: "push", target: "push" });
    const send = guideStep(day1(), draft(["add", "commit", "pull", "push"]));
    expect(send).toMatchObject({ id: "send", target: "send", n: 5 });
    expect(send.text).toMatch(/you'll watch both play out/);
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

  it("speaks while the first day plays back: your push landing, then the day's end", () => {
    const pushed = { kind: "moment", day: 1, moment: { kind: "pushed", player: "ana" } };
    expect(guideOnStep(pushed, "ana")).toMatchObject({ id: "landed", n: 6 });
    expect(guideOnStep({ ...pushed, moment: { kind: "pushed", player: "bot" } }, "ana")).toBeNull();
    expect(guideOnStep({ kind: "summary", day: 1 }, "ana")).toMatchObject({ id: "closed", n: 7 });
  });

  it("builds a second commit on day 2, and teaches the pull when the bot's push landed first", () => {
    const day2 = view({ day: 2, sent_today: [] });
    // ana is one behind in the fixture: the lesson comes first, pointing at a card
    expect(guideStep(day2, draft())).toMatchObject({ id: "lesson", target: "k1" });
    // building again counts as one step, whichever tap it is at
    expect(guideStep(day2, draft([], ["k1"]))).toMatchObject({ id: "add", n: 8 });

    const ahead = { ...day2, players: { ...day2.players, ana: { ...day2.players.ana, behind: 0 } } };
    expect(guideStep(ahead, draft())).toMatchObject({ id: "again", target: "k1" });

    const summary = (behind, order) => guideOnStep({ kind: "summary", day: 2, behind, order }, "ana").text;
    expect(summary(1, ["ana", "bot"])).toMatch(/^The bot's push landed last, so you're behind/);
    expect(summary(0, ["bot", "ana"])).toMatch(/the pull before yours caught you up/);
    expect(summary(0, ["ana", "bot"])).toMatch(/^Your pack ran first and your push landed/);
  });

  it("lets go on the third day, and says nothing after", () => {
    expect(guideStep(view({ day: 3, sent_today: [] }), draft())).toMatchObject({ id: "done", target: null, n: 10 });
    expect(guideStep(view({ day: 4, sent_today: [] }), draft())).toBeNull();
  });

  it("counts its steps, and offers to skip, or 'got it' at the end", () => {
    const layer = guideLayer(guideStep(day1(), draft()), { done() {} });
    expect(layer.querySelector(".guide-step").textContent).toBe("guide · 1 of 10");
    expect(layer.querySelector("button").textContent).toBe("skip the guide");
    const end = guideLayer(guideStep(view({ day: 3, sent_today: [] }), draft()), { done() {} });
    expect(end.querySelector("button").textContent).toBe("got it");
  });
});
