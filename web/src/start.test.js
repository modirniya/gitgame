// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { seatsFrom, startScreen } from "./start.js";
import { isGuided } from "./guide.js";

describe("seats from the start form", () => {
  it("seats you first, then the others at this device, then the bots", () => {
    expect(seatsFrom("quiet-otter-42", " raj, kim ", 1)).toEqual({
      seats: ["quiet-otter-42", "raj", "kim", "bot"],
      hotseat: ["raj", "kim"],
      bots: ["bot"],
    });
    expect(seatsFrom("me", "", 2).seats).toEqual(["me", "bot-1", "bot-2"]);
  });

  it("refuses a table the remote would refuse", () => {
    expect(seatsFrom("me", "", 0).error).toMatch(/2 to 5/);
    expect(seatsFrom("me", "a,b,c", 2).error).toMatch(/2 to 5/);
    expect(seatsFrom("me", "me", 1).error).toMatch(/its own name/);
  });
});

describe("play the bot now", () => {
  const me = { player: { handle: "me", github: null }, link_github: false };

  // Taps the button with `games` already played: what the remote was asked for, and where the screen went.
  async function playBot(games, id) {
    const asked = [];
    const remote = {
      listGames: async () => games,
      createGame: async (body) => (asked.push(body), { id }),
      emailSettings: () => new Promise(() => {}),
    };
    const went = await new Promise((go) => {
      startScreen({ remote, go, me }).querySelector(".start-actions .primary").click();
    });
    return { asked, went };
  }

  it("asks the remote to deal a player's first game guided, and marks it guided here", async () => {
    expect(await playBot([], "g1")).toEqual({
      asked: [{ bots: ["bot"], dayLength: "lunch", guided: true }],
      went: "/g/g1",
    });
    expect(isGuided("g1")).toBe(true);
  });

  it("deals any game after that as it comes", async () => {
    const played = {
      id: "g0",
      seats: ["me", "bot"],
      bots: ["bot"],
      yours: ["me"],
      day: 12,
      final_day: 12,
      released: true,
      waiting_on_you: [],
      scores: { me: 7, bot: 5 },
    };
    expect((await playBot([played], "g2")).asked).toEqual([{ bots: ["bot"], dayLength: "lunch", guided: false }]);
    expect(isGuided("g2")).toBe(false);
  });
});
