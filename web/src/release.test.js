// @vitest-environment jsdom
import { expect, it } from "vitest";
import { el } from "./dom.js";
import { ciGrid, scoreboard } from "./release.js";
import { view } from "./view.fixture.js";

const up = (id, author, over = {}) => ({
  id,
  author,
  files: ["auth.js"],
  lines: 3,
  flipped: true,
  bug: false,
  ...over,
});

// main as the release leaves it: every commit face-up, a bug that counted, and one a revert took back
const released = view({
  main: [
    { id: "16bb9f2", initial: true },
    up("a1", "ana"),
    up("b1", "bot", { bug: true }),
    up("a2", "ana", { bug: true, reverted: true }),
    up("r1", "ana", { revert_of: "a2", files: [], lines: 0 }),
  ],
});
const ci = (bugs, flips) => ({ kind: "ci", ci: { by: "bot", bugs, production_down: false, flips } });
const flip = (commit, author, bug = false) => ({ commit, author, bug, blamed_now: bug });

it("CI turns every commit on main face-up in order, 250 ms apart, the bugs that counted marked", () => {
  const flips = [flip("a1", "ana"), flip("b1", "bot", true), flip("a2", "ana")];
  const node = el("div", {}, ciGrid(ci(1, flips), released));
  const cells = [...node.querySelectorAll(".ci-grid > li")];

  expect(cells.map((li) => li.querySelector(".card").dataset.id)).toEqual(["a1", "b1", "a2", "r1"]);
  // the delay of each flip is its place on main (release.css)
  expect(cells.map((li) => li.style.getPropertyValue("--i"))).toEqual(["0", "1", "2", "3"]);
  // at rest every card is face-up, which is all that shows under prefers-reduced-motion
  expect(cells.every((li) => li.querySelector(".card.sm.commit.up"))).toBe(true);
  // a reverted bug no longer counts, as the remote said
  const counted = cells.filter((li) => li.classList.contains("counts"));
  expect(counted.map((li) => li.querySelector(".card").dataset.id)).toEqual(["b1"]);
  expect(counted[0].querySelector("span.bug").textContent).toBe("BUG");

  const stamp = node.querySelector(".stamp");
  expect(stamp.textContent).toBe("1 bug reached production");
  expect(stamp.classList.contains("bad")).toBe(true);
  expect(stamp.style.getPropertyValue("--n")).toBe("4");
});

it("tallies a clean release in green", () => {
  const node = el("div", {}, ciGrid(ci(0, [flip("a1", "ana")]), released));
  expect(node.querySelector(".stamp.ok").textContent).toBe("0 bugs reached production");
  expect(node.querySelectorAll(".counts")).toHaveLength(0);
});

const score = (over) => ({ lines: 0, fixes: 0, blame: 0, merge: 0, grudges: 0, sins: 0, total: 0, ...over });
const scores = {
  bot: score({ lines: 22, blame: -9, total: 13 }),
  ana: score({ lines: 20, fixes: 1, merge: -1, total: 20 }),
};
const cells = (row) => [...row.querySelectorAll("td")].map((td) => td.textContent);

it("reads across: a row per part of the score, your column first, the totals below, and who won", () => {
  const over = view({ seats: ["bot", "ana"], scores, released: { day: 12, bugs: 1, production_down: false } });
  const node = scoreboard(over, null, el("form", { class: "feedback" }));

  expect(node.querySelector("h1").textContent).toBe("The release shipped.");
  expect(node.querySelector(".winner.you").textContent).toBe("You win.");
  expect([...node.querySelectorAll("thead th")].map((th) => th.textContent)).toEqual(["you", "bot"]);
  expect(node.querySelector("thead th.you").textContent).toBe("you");

  const rows = [...node.querySelectorAll("tbody tr")];
  expect(rows.map((r) => r.querySelector("th").textContent)).toEqual([
    "lines on main",
    "fixes",
    "blame",
    "merge tokens",
    "grudges",
    "sins",
  ]);
  expect(cells(rows[0])).toEqual(["20", "22"]);
  expect(cells(rows[2])).toEqual(["0", "−9"]);
  expect(cells(rows[3])).toEqual(["−1", "0"]);
  expect(cells(node.querySelector("tfoot tr"))).toEqual(["20", "13"]);

  expect(node.querySelector(".said").textContent).toBe(
    "What decided it: ana won by 7, most of it in blame (+9 over bot).",
  );
  expect(node.querySelector(".body .feedback")).not.toBeNull();
  expect(node.querySelector('.actions a[href="#/r/g1"]').textContent).toBe("replay it");
});

it("when production is down, the least blame wins, whatever the totals; seen from no seat", () => {
  const down = view({ you: null, scores, released: { day: 12, bugs: 4, production_down: true } });
  const node = scoreboard(down, null, null);

  expect(node.querySelector("h1.down").textContent).toBe("Production is down: 4 bugs.");
  expect(node.querySelector(".winner.other").textContent).toBe("ana wins.");
  // the seats in the table's order, none of them yours
  expect([...node.querySelectorAll("thead th")].map((th) => th.textContent)).toEqual(["ana", "bot"]);
  expect(node.querySelectorAll(".you")).toHaveLength(0);
  expect(node.querySelector(".said").textContent).toBe(
    "What decided it: Production went down, so the least blame won: ana at 0, bot at -9.",
  );
});

it("calls a tie a draw", () => {
  const tie = { ana: score({ total: 10 }), bot: score({ total: 10 }) };
  const node = scoreboard(view({ scores: tie, released: { day: 12, bugs: 0, production_down: false } }), null, null);
  expect(node.querySelector(".winner.draw").textContent).toBe("A draw.");
});
