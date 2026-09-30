import { describe, expect, it } from "vitest";
import { actions, add, price } from "./pack.js";
import { view } from "./view.fixture.js";

// In the fixture ana is 1 behind: bot's 15efd4d (README.md) is on main past her pointer.
const mine = (id, file) => ({
  id,
  author: "ana",
  message: "",
  flipped: false,
  cards: [{ id: `c-${id}`, kind: "commit", file, lines: 3, bug: false }],
});
const at = (over) => view({ you: { ...view().you, ...over } });

describe("writing a pack", () => {
  it("puts a pull before a push by default, and only one per landing", () => {
    const v = view();
    let ops = add(v, [], { op: "push" });
    expect(ops).toEqual([{ op: "pull" }, { op: "push" }]);

    ops = add(v, [{ op: "pull" }, { op: "add", cards: ["k1"] }], { op: "push" });
    expect(ops.map((o) => o.op)).toEqual(["pull", "add", "push"]);
  });

  it("adds no pull when it would push the pack past its limit", () => {
    const three = [{ op: "add", cards: ["k1"] }, { op: "commit" }, { op: "tag" }];
    expect(add(view(), three, { op: "push" }).map((o) => o.op)).toEqual(["add", "commit", "tag", "push"]);
    expect(add(view(), [...three, { op: "push" }], { op: "push" })).toHaveLength(4);
  });
});

describe("pricing a pack as the remote will charge it", () => {
  it("charges local ops their cost and follows your cards through them", () => {
    const { rows, spent, left } = price(view(), [{ op: "add", cards: ["k1", "k2"] }, { op: "commit" }]);
    expect(rows.map((r) => r.cost)).toEqual([1, 1]);
    expect(rows[0].note).toBe("stages a bug");
    expect(rows[1].note).toBe("+8 lines");
    expect(spent).toBe(2);
    expect(left.hand.map((c) => c.id)).toEqual(["k3"]);
    expect(left.local).toEqual([["auth.js", "api.py"]]);
  });

  it("a pull when behind costs 1; at the tip it's free now and 1 if someone pushes first", () => {
    expect(price(view(), [{ op: "pull" }]).rows[0]).toMatchObject({
      cost: 1,
      most: 1,
      note: "fast-forwards to the tip",
    });

    const tip = view({ players: { ...view().players, ana: { ...view().players.ana, behind: 0, pointer: 3 } } });
    expect(price(tip, [{ op: "pull" }]).rows[0]).toMatchObject({ cost: 0, most: 1 });
    expect(price(tip, [{ op: "pull", rebase: true }]).rows[0]).toMatchObject({ cost: 0, most: 2 });
  });

  it("sees a conflict coming, and what the declared strategy will do about it", () => {
    const v = at({ local: [mine("x1", "README.md")] });
    expect(price(v, [{ op: "pull" }]).rows[0].note).toBe("CONFLICT coming in README.md: -X theirs");
    expect(price(v, [{ op: "pull" }]).left.local).toEqual([]);

    const resolve = price(v, [{ op: "pull", strategy: "resolve" }]);
    expect(resolve.rows[0]).toMatchObject({ cost: 2, most: 2 });
    expect(resolve.left.local).toEqual([["README.md"]]);
  });

  it("a merge takes a token; a push from behind is rejected; a push of nothing is free", () => {
    const v = at({ local: [mine("x1", "auth.js")] });
    expect(price(v, [{ op: "pull" }]).rows[0].note).toBe("merges: takes a merge token");
    expect(price(v, [{ op: "push" }]).rows[0].note).toMatch(/rejected/);
    expect(price(view(), [{ op: "pull" }, { op: "push" }]).rows[1]).toMatchObject({
      cost: 0,
      most: 0,
      note: "nothing to push: free",
    });
  });

  it("marks the ops the budget can't cover, and those it might not", () => {
    const v = at({ local: [mine("x1", "auth.js")] });
    const { rows } = price(v, [{ op: "pull", rebase: true }, { op: "push" }, { op: "add", cards: ["k1"] }]);
    expect(rows.map((r) => r.runs)).toEqual([true, true, false]);

    const tip = view({ players: { ...view().players, ana: { ...view().players.ana, behind: 0 } } });
    const maybe = price(tip, [{ op: "pull" }, { op: "add", cards: ["k1"] }, { op: "commit" }, { op: "push" }]);
    // if someone pushes first, the pull costs 1 and the push is the op that no longer fits
    expect(maybe.rows.map((r) => r.maybe)).toEqual([false, false, false, true]);
  });
});

describe("what the hub offers", () => {
  it("offers what your hand and the table allow, and says why not otherwise", () => {
    const a = actions(view(), [], ["k1"]);
    expect(a.add).toBeNull();
    expect(a.commit).toBe("nothing added to commit");
    expect(a.force).toBeNull(); // ana holds a force card and is 1 behind
    expect(a.blame).toBe("no git blame card");
    expect(a.tag).toBe("main has 2 commits; v1.0 needs 10");
    expect(actions(view({ main: view().main.slice(0, 2) }), []).tag).toBe("main has 1 commit; v1.0 needs 10");
  });

  it("closes command cards on a day that forbids them", () => {
    const v = view({ commands_allowed: false, incident: { name: "Stack Overflow Is Down" } });
    expect(actions(v, []).force).toBe("Stack Overflow Is Down: no command cards today");
  });

  it("offers nothing more once the pack is full", () => {
    const full = [{ op: "pull" }, { op: "pull" }, { op: "pull" }, { op: "pull" }];
    expect(actions(view(), full).pull).toBe("a pack is at most 4 ops");
  });
});
