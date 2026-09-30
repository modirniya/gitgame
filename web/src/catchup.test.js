import { describe, expect, it } from "vitest";
import { catchup } from "./catchup.js";
import { view } from "./view.fixture.js";
import game from "./game.fixture.json";

const opened = { type: "day_opened", day: 2, incident: "flaky_ci", budget: 3 };

describe("catching up", () => {
  it("a new reader sees today's incident, and nothing more on day 1", () => {
    const { queue, memory } = catchup(view({ day: 1, today: [{ ...opened, day: 1 }] }));
    expect(queue.map((m) => m.kind)).toEqual(["incident"]);
    expect(queue[0].coach).toMatch(/^A new day/);
    expect(memory).toEqual({ logs: 0, opened: 1, seen: [] });
  });

  it("after a week away: every day's big moments in order, then today", () => {
    const v = view({ you: { ...view().you, player: "ana" }, days: game.days.slice(0, 5), day: 6, today: [opened] });
    const { queue, memory } = catchup(v, { logs: 0, opened: 1, seen: [] });

    expect(queue.at(-1).kind).toBe("incident");
    expect(queue.filter((m) => m.kind === "pushed")).toHaveLength(1);
    expect(memory.logs).toBe(5);
    expect(memory.opened).toBe(6);

    // and having read them, the same view has nothing new
    expect(catchup(v, memory).queue).toEqual([]);
  });

  it("a push seen on an earlier day gets no second screen", () => {
    const v = view({ days: game.days.slice(0, 5), day: 6, today: [opened] });
    const first = catchup(v, { logs: 0, opened: 6, seen: ["pushed", "pulled"] });
    expect(first.queue.map((m) => m.kind)).not.toContain("pushed");
  });

  it("a released game ends on CI, with no new day to open", () => {
    const v = view({ you: { ...view().you, player: "ana" }, days: game.days, released: { bugs: 0 }, today: [] });
    const { queue } = catchup(v, { logs: game.days.length - 1, opened: 11, seen: ["pushed", "pulled"] });
    expect(queue.at(-1).kind).toBe("ci");
  });
});
