import { expect, it } from "vitest";
import { route } from "./route.js";

it("reads a game and a seat from the address, and starts anywhere else", () => {
  expect(route("#/g/abc/ana%20b")).toEqual({ screen: "game", id: "abc", player: "ana b" });
  expect(route("#/g/abc")).toEqual({ screen: "start" });
  expect(route("")).toEqual({ screen: "start" });
});
