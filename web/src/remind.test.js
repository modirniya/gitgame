// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { keyBytes, offerReminders, remindButton } from "./remind.js";
import { view } from "./view.fixture.js";

it("turns the remote's base64url key into the bytes the PushManager takes", () => {
  const bytes = keyBytes("BAAB_-8");
  expect([...bytes]).toEqual([4, 0, 1, 255, 239]);
});

it("offers nothing in a browser that can't be reminded", () => {
  const node = remindButton({ pushKey: async () => "key" });
  expect(node.textContent).toBe("");
});

describe("when to offer reminders", () => {
  const opened = (player, ops) => ({ type: "pack_opened", player, budget: 3, ops });
  const day = (...log) => ({ day: 1, log: [...log, { type: "day_closed", day: 1 }] });
  const game = (over) => view({ reminders: true, sent_today: ["bot"], days: [], ...over });

  it("once you've sent a pack, even when yours closed the day and the next has opened", () => {
    expect(offerReminders(game({ days: [day(opened("ana", 3), opened("bot", 3))] }))).toBe(true);
    expect(offerReminders(game({ sent_today: ["bot", "ana"] }))).toBe(true);
  });

  it("not before, nor for an absent day's empty pack", () => {
    expect(offerReminders(game())).toBe(false);
    expect(offerReminders(game({ days: [day(opened("ana", 0), opened("bot", 3))] }))).toBe(false);
  });

  it("not in a game whose days are too short to be reminded of, nor once it's released", () => {
    const sent = { days: [day(opened("ana", 3))] };
    expect(offerReminders(game({ ...sent, reminders: false }))).toBe(false);
    expect(offerReminders(game({ ...sent, released: { day: 7, bugs: 0 } }))).toBe(false);
  });
});
