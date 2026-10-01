import { expect, it } from "vitest";
import { whatDecidedIt, winners } from "./verdict.js";

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

it("when production is down, says the least blame won, as the remote decides it", () => {
  const scores = { ana: score({ total: 5, blame: -3 }), bot: score({ total: 12, blame: -9 }) };
  expect(winners(scores, true)).toEqual(["ana"]);
  expect(winners(scores)).toEqual(["bot"]);
  expect(whatDecidedIt(scores, true)).toBe("Production went down, so the least blame won: ana at -3, bot at -9.");
  // ties share the win
  expect(winners({ ana: score({ total: 4 }), bot: score({ total: 4 }) })).toEqual(["ana", "bot"]);
});

it("says a tie is a tie", () => {
  expect(whatDecidedIt({ ana: score({ total: 10 }), bot: score({ total: 10 }) })).toBe(
    "A tie at 10, between ana and bot.",
  );
});
