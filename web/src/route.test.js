import { expect, it } from "vitest";
import { route } from "./route.js";

it("reads a game and a seat from the address, and starts anywhere else", () => {
  expect(route("#/g/abc/ana%20b")).toEqual({ screen: "game", id: "abc", seat: "ana b" });
  expect(route("#/g/abc")).toEqual({ screen: "game", id: "abc", seat: null });
  expect(route("#/room/k7m2x9qa")).toEqual({ screen: "room", code: "k7m2x9qa" });
  expect(route("#/r/abc")).toEqual({ screen: "replay", id: "abc", day: 0 });
  expect(route("#/r/abc/4")).toEqual({ screen: "replay", id: "abc", day: 4 });
  expect(route("#/r/abc/x")).toEqual({ screen: "replay", id: "abc", day: 0 });
  expect(route("")).toEqual({ screen: "start" });
});
