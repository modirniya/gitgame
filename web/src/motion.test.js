// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { el } from "./dom.js";
import { play, snapshot } from "./motion.js";

// jsdom lays nothing out: give each node the box it would have, and record what is played
const at = (node, left, top) => (node.getBoundingClientRect = () => ({ left, top, width: 64, height: 90 }));
const played = [];
Element.prototype.animate = function (frames) {
  played.push([this.dataset.id ?? this.dataset.seat ?? "copy", frames.at(0).transform ?? frames.at(0).opacity]);
  return { finished: Promise.resolve() };
};
afterEach(() => (played.length = 0));

it("plays what moved from where it was, pops what is new, and flies what was folded into it", () => {
  const card = el("div", { "data-id": "k1" });
  const chip = el("span", { "data-seat": "ana" });
  at(card, 10, 500);
  at(chip, 0, 100);
  const before = snapshot(el("div", {}, card, chip));

  // a commit: k1 is folded into a new commit, and the pointer moved to the tip
  const made = el("div", { "data-id": "new" });
  const moved = el("span", { "data-seat": "ana" });
  at(made, 200, 300);
  at(moved, 80, 100);
  const root = el("div", {}, made, moved);
  document.body.append(root);
  play(root, before);

  expect(played.map(([who]) => who).sort()).toEqual(["ana", "copy", "new"]);
  expect(played.find(([who]) => who === "ana")[1]).toMatch(/^translate\(-80px, 0px\)/);
});

it("moves nothing under prefers-reduced-motion", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  const card = el("div", { "data-id": "k1" });
  at(card, 0, 0);
  const before = snapshot(el("div", {}, card));
  const again = el("div", { "data-id": "k1" });
  at(again, 50, 50);
  play(el("div", {}, again), before);
  expect(played).toEqual([]);
  vi.unstubAllGlobals();
});
