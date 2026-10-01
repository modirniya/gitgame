import { expect, it } from "vitest";
import { moved } from "./landing.js";

it("sends a link from before the game moved on to /play, and keeps the page's own anchors", () => {
  expect(moved({ hash: "#/room/k7m2x9qa", search: "" })).toBe("/play#/room/k7m2x9qa");
  expect(moved({ hash: "#/g/abc", search: "?utm_source=hn" })).toBe("/play?utm_source=hn#/g/abc");
  expect(moved({ hash: "#faq", search: "" })).toBeNull();
  expect(moved({ hash: "", search: "?utm_source=hn" })).toBeNull();
});
