// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { command, hub } from "./hub.js";
import { view } from "./view.fixture.js";

const render = (v, draft = { ops: [], selected: [], picking: null }) => {
  const changes = [];
  const node = hub({ view: v, draft, change: (d) => changes.push(d), send: () => changes.push("sent") });
  const button = (label) => [...node.querySelectorAll("button")].find((b) => b.firstChild?.textContent === label);
  return { node, changes, button };
};

describe("the hub", () => {
  it("writes each op as the command a terminal would show", () => {
    const v = view();
    expect(command({ op: "add", cards: ["k1", "k2"] }, v)).toBe("git add auth.js api.py");
    expect(command({ op: "pull", rebase: true, strategy: "ours" }, v)).toBe("git pull --rebase -X ours");
    expect(command({ op: "force" }, v)).toBe("git push --force");
  });

  it("adds the selected cards, and a pull before a push", () => {
    const { changes, button } = render(view(), { ops: [], selected: ["k1"], picking: null });
    button("add").click();
    expect(changes[0].ops).toEqual([{ op: "add", cards: ["k1"] }]);
    expect(changes[0].selected).toEqual([]);

    button("push").click();
    expect(changes[1].ops.map((o) => o.op)).toEqual(["pull", "push"]);
  });

  it("greys out what can't be played, and says why", () => {
    const blame = render(view()).button("blame");
    expect(blame.disabled).toBe(true);
    expect(blame.textContent).toContain("no git blame card");
  });

  it("lists the pack with each op's cost, now and at most", () => {
    const { node } = render(view(), { ops: [{ op: "pull" }, { op: "push" }], selected: [], picking: null });
    const rows = [...node.querySelectorAll(".pack .op")];
    expect(rows.map((r) => r.querySelector(".cmd").textContent)).toEqual(["git pull", "git push"]);
    expect(rows.map((r) => r.querySelector(".cost").textContent)).toEqual(["1", "0"]);
  });

  it("shows your unpushed commits face-up, bug and all", () => {
    const local = [
      {
        id: "x1",
        author: "ana",
        message: "wip",
        flipped: false,
        cards: [{ id: "c", kind: "commit", file: "auth.js", lines: 4, bug: true }],
      },
    ];
    const { node } = render(view({ you: { ...view().you, local } }));
    const mine = node.querySelector('.branch [data-id="x1"]');
    expect(mine.classList.contains("bug")).toBe(true);
    expect(node.querySelector(".branch h2").textContent).toBe("your branch · 1 to push");
    // nothing staged: no staging row, and no stray count either
    expect(node.querySelector(".branch").textContent).not.toMatch(/0$/);
  });

  it("offers to replace a pack already sent today", () => {
    const v = view({ sent_today: ["ana", "bot"] });
    expect(render(v).node.querySelector(".send").textContent).toBe("replace today's pack");
  });
});
