// @vitest-environment jsdom
import { expect, it } from "vitest";
import { frame, pips } from "./frame.js";
import { view } from "./view.fixture.js";

it("frames every screen with the day, main, the ops left, the live score and the Table", () => {
  const opened = [];
  const node = frame(view(), { left: 2, onTable: () => opened.push(true) });
  const text = [...node.children].map((c) => c.textContent);
  expect(text.slice(0, 2)).toEqual(["day 2/12", "main 2/10"]);
  expect(node.querySelectorAll(".pips i.on")).toHaveLength(2);
  expect(node.querySelector(".pips").getAttribute("aria-label")).toBe("2 of 3 ops left");
  expect(node.querySelector(".score").textContent).toBe("you 7 · bot 1");

  node.querySelector(".table-button").click();
  expect(opened).toEqual([true]);
});

it("shows no pips when there is no pack to write, and the table's score to someone without a seat", () => {
  const node = frame(view({ you: null }), {});
  expect(node.querySelector(".pips")).toBeNull();
  expect(node.querySelector(".score").textContent).toBe("ana 7 · bot 1");
});

it("draws a pip for every op even past the usual budget", () => {
  expect(pips(4, 3).querySelectorAll("i")).toHaveLength(4);
});
