import { describe, expect, it } from "vitest";
import { seatsFrom } from "./start.js";

describe("seats from the start form", () => {
  it("seats the people first, then the bots", () => {
    expect(seatsFrom(" ana, raj ", 1)).toEqual({
      seats: ["ana", "raj", "bot"],
      humans: ["ana", "raj"],
      bots: ["bot"],
    });
    expect(seatsFrom("ana", 2).seats).toEqual(["ana", "bot-1", "bot-2"]);
  });

  it("refuses a table the remote would refuse", () => {
    expect(seatsFrom("", 2).error).toMatch(/at least one person/);
    expect(seatsFrom("ana", 0).error).toMatch(/2 to 5/);
    expect(seatsFrom("a,b,c,d", 2).error).toMatch(/2 to 5/);
    expect(seatsFrom("bot", 1).error).toMatch(/its own name/);
  });
});
