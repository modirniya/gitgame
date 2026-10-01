// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { command, hub } from "./hub.js";
import { view } from "./view.fixture.js";

const render = (v, draft = { ops: [], selected: [], picking: null }) => {
  const changes = [];
  const node = hub({ view: v, draft, change: (d) => changes.push(d), send: () => changes.push("sent") });
  const button = (label) =>
    [...node.querySelectorAll("button:not(.card)")].find((b) => b.firstChild?.textContent === label);
  return { node, changes, button };
};

describe("the hub", () => {
  it("writes each op as the command a terminal would show", () => {
    const v = view();
    expect(command({ op: "add", cards: ["k1", "k2"] }, v)).toBe("git add auth.js api.py");
    // Git names the sides from where the merge runs: under --rebase, keeping your side is -X theirs
    expect(command({ op: "pull", rebase: true, strategy: "ours" }, v)).toBe("git pull --rebase -X theirs");
    expect(command({ op: "pull", strategy: "ours" }, v)).toBe("git pull -X ours");
    // the default is written out, since it is what happens on a conflict; by hand has no flag, as in Git
    expect(command({ op: "pull" }, v)).toBe("git pull -X theirs");
    expect(command({ op: "pull", strategy: "resolve" }, v)).toBe("git pull");
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
    expect(rows.map((r) => r.querySelector(".cmd").textContent)).toEqual(["git pull -X theirs", "git push"]);
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

  it("takes a commit message as it is typed, with no re-render to swallow the tap on send", () => {
    const draft = { ops: [{ op: "commit", message: "" }], selected: [], picking: null };
    const { node, changes } = render(view(), draft);
    const input = node.querySelector(".pack .message");
    input.value = "fix: the login";
    input.dispatchEvent(new Event("input"));
    input.dispatchEvent(new Event("change"));

    expect(changes).toEqual([]);
    expect(draft.ops[0].message).toBe("fix: the login");
    expect(node.querySelector(".pack .cmd").textContent).toBe('git commit -m "fix: the login"');
  });

  it("starts a commit with a real message for what is staged, and offers others", () => {
    const { changes, button } = render(view(), { ops: [{ op: "add", cards: ["k1"] }], selected: [], picking: null });
    button("commit").click();
    const message = changes[0].ops[1].message;
    expect(message).toMatch(/^\w+(\(\w+\))?: /);

    const { node } = render(view(), changes[0]);
    expect(node.querySelectorAll(".pack .cmd")[1].textContent).toBe(`git commit -m ${JSON.stringify(message)}`);
    const offered = [...node.querySelectorAll(".pack .suggestion")];
    expect(offered.length).toBeGreaterThan(1);
    offered[1].click();
    expect(changes[0].ops[1].message).toBe(offered[1].textContent);
    expect(node.querySelector(".pack .message").value).toBe(offered[1].textContent);
  });

  it("tags v1.0 once a pack", () => {
    const main = [view().main[0], ...Array.from({ length: 10 }, (_, i) => ({ ...view().main[1], id: `c${i}` }))];
    const { button } = render(view({ main }), { ops: [{ op: "tag" }], selected: [], picking: null });
    expect(button("tag v1.0").disabled).toBe(true);
    expect(button("tag v1.0").textContent).toContain("already tagged");
  });

  it("offers to replace a pack already sent today", () => {
    const v = view({ sent_today: ["ana", "bot"] });
    expect(render(v).node.querySelector(".send").textContent).toBe("replace today's pack");
  });
});

import { fanLayout } from "./hub.js";

it("fans the hand in one row while every card keeps a finger's width, and in two rows past that", () => {
  // a phone's 343 px: six cards fit in one row, seven need two
  expect(fanLayout(6, 343)).toEqual({ rows: 1, perRow: 6, overlap: 47 });
  expect(fanLayout(7, 343)).toEqual({ rows: 2, perRow: 4, overlap: 14 });
  expect(fanLayout(10, 343)).toMatchObject({ rows: 2, perRow: 5 });
  expect(fanLayout(10, 343).overlap).toBeLessThanOrEqual(96 - 44);
  // few cards on a wide screen don't overlap at all
  expect(fanLayout(3, 608).overlap).toBe(0);
});
