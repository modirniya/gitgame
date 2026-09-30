import { describe, expect, it } from "vitest";
import { seatsFrom } from "./start.js";

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
