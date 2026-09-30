import { expect, it } from "vitest";
import { whatDecidedIt } from "./verdict.js";

const score = (over) => ({ total: 0, lines: 0, fixes: 0, blame: 0, sins: 0, grudges: 0, merge: 0, ...over });

it("says who won, by how much, and which part of the score made the difference", () => {
  expect(
    whatDecidedIt({ ana: score({ total: 36, lines: 37, merge: -1 }), bot: score({ total: 28, lines: 29, merge: -1 }) }),
  ).toBe("ana won by 8, most of it in lines shipped (+8 over bot).");
  // bot shipped more, but its bugs were blamed
  expect(whatDecidedIt({ ana: score({ total: 20, lines: 20 }), bot: score({ total: 13, lines: 22, blame: -9 }) })).toBe(
    "ana won by 7, most of it in blame (+9 over bot).",
  );
});

it("says a tie is a tie", () => {
  expect(whatDecidedIt({ ana: score({ total: 10 }), bot: score({ total: 10 }) })).toBe(
    "A tie at 10, between ana and bot.",
  );
});
