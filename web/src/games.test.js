// @vitest-environment jsdom
import { describe as group, expect, it } from "vitest";
import { describe, gamesList } from "./games.js";

const game = (over = {}) => ({
  id: "g1",
  seats: ["me", "bot"],
  bots: ["bot"],
  yours: ["me"],
  day: 3,
  final_day: 12,
  released: false,
  waiting_on_you: ["me"],
  scores: { me: 7, bot: 5 },
  ...over,
});

group("your games", () => {
  it("says what each game is waiting for", () => {
    expect(describe(game())).toEqual({ against: "vs bot", status: "day 3/12 · your pack is due", due: true });
    expect(describe(game({ waiting_on_you: [] })).status).toBe("day 3/12 · waiting for the others");
    expect(describe(game({ seats: ["me", "raj"], yours: ["me", "raj"], waiting_on_you: ["raj"] }))).toMatchObject({
      against: "hotseat",
      status: "day 3/12 · your pack is due (raj)",
    });
  });

  it("says how a finished game went", () => {
    expect(describe(game({ released: true, waiting_on_you: [] })).status).toBe("v1.0 shipped · you won, 7");
    expect(describe(game({ released: true, scores: { me: 2, bot: 5 } })).status).toBe("v1.0 shipped · you lost, 2");
  });

  it("links each game, and marks the ones due", () => {
    const list = gamesList([game(), game({ id: "g2", waiting_on_you: [] })]);
    expect([...list.querySelectorAll("a")].map((a) => a.getAttribute("href"))).toEqual(["#/g/g1", "#/g/g2"]);
    expect(list.querySelector("li").classList.contains("due")).toBe(true);
    expect(gamesList([])).toBeNull();
  });
});
