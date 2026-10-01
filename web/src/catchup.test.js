import { describe, expect, it } from "vitest";
import { catchup } from "./catchup.js";
import { view } from "./view.fixture.js";
import game from "./game.fixture.json";

const opened = { type: "day_opened", day: 2, incident: "flaky_ci", budget: 3 };
const kinds = (queue) => queue.map((s) => (s.kind === "moment" ? s.moment.kind : s.kind));

describe("catching up", () => {
  it("a new reader sees today's incident, and nothing more on day 1", () => {
    const { queue, memory } = catchup(view({ day: 1, today: [{ ...opened, day: 1 }] }));
    expect(kinds(queue)).toEqual(["incident"]);
    expect(queue[0].moment.coach).toMatch(/^A new day/);
    expect(memory).toEqual({ logs: 0, opened: 1 });
  });

  it("after a week away: every day played back and ending on its receipt, then today", () => {
    const v = view({
      you: { ...view().you, player: "ana" },
      bots: ["bot"],
      main: game.main,
      days: game.days.slice(0, 5),
      day: 6,
      today: [opened],
    });
    const { queue, memory } = catchup(v, { logs: 0, opened: 1 });

    expect(queue.at(-1).moment.kind).toBe("incident");
    expect(queue.filter((s) => s.kind === "summary").map((s) => s.day)).toEqual([1, 2, 3, 4, 5]);
    // each step knows its day, for the frame, and the score as that day opened
    expect(queue[0].day).toBe(1);
    expect(queue[0].score).toEqual(game.days[0].opened.scores);
    expect(memory).toEqual({ logs: 5, opened: 6 });

    // and having read them, the same view has nothing new
    expect(catchup(v, memory).queue).toEqual([]);
  });

  it("a released game ends on CI and the last day's receipt, with no new day to open", () => {
    const v = view({
      you: { ...view().you, player: "ana" },
      main: game.main,
      days: game.days,
      released: { bugs: 0 },
      today: [],
    });
    const { queue } = catchup(v, { logs: game.days.length - 1, opened: 11 });
    expect(kinds(queue).slice(-2)).toEqual(["ci", "summary"]);
  });
});
