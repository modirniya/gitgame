// @vitest-environment jsdom
import { expect, it } from "vitest";
import { keyBytes, remindButton } from "./remind.js";

it("turns the remote's base64url key into the bytes the PushManager takes", () => {
  const bytes = keyBytes("BAAB_-8");
  expect([...bytes]).toEqual([4, 0, 1, 255, 239]);
});

it("offers nothing in a browser that can't be reminded", () => {
  const node = remindButton({ pushKey: async () => "key" });
  expect(node.textContent).toBe("");
});
