// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fanLayout, hub } from "./hub.js";
import { command } from "./packlist.js";
import { price } from "./pack.js";
import { view } from "./view.fixture.js";

const render = (v, draft = { ops: [], selected: [], picking: null }) => {
  const changes = [];
  const node = hub({ view: v, draft, change: (d) => changes.push(d), send: () => changes.push("sent") });
  const action = (key) => node.querySelector(`.actions [data-guide="${key}"]`);
  return { node, changes, action };
};
const at = (ops, selected = []) => ({ ops, selected, picking: null });

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

  it("puts the four actions and send at the thumb, each with its cost and what it would do", () => {
    const { node, action } = render(view(), at([], ["k1"]));
    const names = [...node.querySelectorAll(".actions .grid4 .opname")].map((b) => b.textContent);
    expect(names).toEqual(["git add", "git commit", "git push", "git pull"]);
    expect(action("add").querySelector(".cost").textContent).toBe("1 op");
    expect(action("add").querySelector(".will").textContent).toBe("stage 1 card, +5");
    // ana is one behind: the push brings its pull, which costs an op now
    expect(action("pull").querySelector(".cost").textContent).toBe("1 op");
    expect(node.querySelector(".actions .send").textContent).toBe("send pack");
    // one sentence for a screen reader
    expect(action("add").getAttribute("aria-label")).toBe("git add, 1 op: stage 1 card, +5");
  });

  it("adds the selected cards, and a pull before a push", () => {
    const { changes, action } = render(view(), at([], ["k1"]));
    action("add").click();
    expect(changes[0].ops).toEqual([{ op: "add", cards: ["k1"] }]);
    expect(changes[0].selected).toEqual([]);

    action("push").click();
    expect(changes[1].ops.map((o) => o.op)).toEqual(["pull", "push"]);
  });

  it("greys out what can't be played, and says why", () => {
    const add = render(view()).action("add");
    expect(add.disabled).toBe(true);
    expect(add.querySelector(".why").textContent).toBe("select cards in your hand");
  });

  it("plays a command card once it is picked from the hand, on its own", () => {
    const { node, changes } = render(view(), at([], ["k1"]));
    expect(node.querySelector('.actions [data-guide="force"]')).toBeNull();
    node.querySelector('.hand-rows [data-id="k3"]').click();
    expect(changes[0].selected).toEqual(["k3"]);

    const picked = render(view(), changes[0]);
    const force = picked.action("force");
    expect(force.classList.contains("wide")).toBe(true);
    force.click();
    expect(picked.changes[0].ops).toEqual([{ op: "force" }]);
  });

  it("draws your branch as the pack leaves it after every op", () => {
    const v = view();
    // after git add: the card is staged, out of the hand
    let { node } = render(v, at([{ op: "add", cards: ["k1"] }]));
    expect(node.querySelector('[data-zone="staged"] [data-id="k1"]')).not.toBeNull();
    expect(node.querySelector('.hand-rows [data-id="k1"]')).toBeNull();

    // after git commit: one commit to push, of the pack model's lines
    const ops = [
      { op: "add", cards: ["k1"] },
      { op: "commit", message: "feat(auth): rate-limit login attempts" },
    ];
    ({ node } = render(v, at(ops)));
    const made = price(v, ops).left.local;
    expect(made).toHaveLength(1);
    expect(node.querySelector('[data-zone="staged"] .empty')).not.toBeNull();
    expect(node.querySelector('[data-zone="local"] .card').getAttribute("aria-label")).toBe(
      "new by ana: auth.js +5, clean",
    );

    // after git push: the commit waits past the tip, where it lands if it does
    ({ node } = render(v, at([...ops, { op: "pull" }, { op: "push" }])));
    expect(node.querySelector('[data-zone="local"] .empty')).not.toBeNull();
    const ghost = node.querySelector(".strip .slot.ghost");
    expect(ghost.querySelector(".tipmark").textContent).toBe("your push");
    expect(ghost.querySelector(".who").textContent).toBe("you auth.js +5");
  });

  it("says where you stand, and when the pack's pull catches you up", () => {
    expect(render(view()).node.querySelector(".standing").textContent).toBe("1 behind");
    expect(render(view(), at([{ op: "pull" }])).node.querySelector(".standing").textContent).toBe(
      "1 behind · the pack catches up",
    );
  });

  it("takes back the last op", () => {
    const { node, changes } = render(view(), at([{ op: "pull" }, { op: "push" }]));
    node.querySelector(".actions .undo").click();
    expect(changes[0].ops).toEqual([{ op: "pull" }]);
    expect(render(view()).node.querySelector(".actions .undo").disabled).toBe(true);
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
    expect(node.querySelector('.branch [data-id="x1"]').classList.contains("bug")).toBe(true);
  });

  it("takes a commit message as it is typed, with no re-render to swallow the tap on send", () => {
    const draft = at([{ op: "commit", message: "" }]);
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
    const { changes, action } = render(view(), at([{ op: "add", cards: ["k1"] }]));
    action("commit").click();
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

  it("offers the tag once main is the release size, and once a pack", () => {
    const main = [view().main[0], ...Array.from({ length: 10 }, (_, i) => ({ ...view().main[1], id: `c${i}` }))];
    expect(render(view({ main })).action("tag").classList.contains("wide")).toBe(true);
    expect(render(view({ main }), at([{ op: "tag" }])).action("tag")).toBeNull();
    expect(render(view()).action("tag")).toBeNull();
  });

  it("offers a hint, and writes it into the pack on a tap, its reasons left out", () => {
    const asked = [];
    const hint = {
      ops: [
        { op: "add", cards: ["k1"], why: "you build a commit" },
        { op: "commit", message: "feat(auth): rate-limit login attempts", why: "you commit what you staged" },
      ],
    };
    const changes = [];
    const node = hub({
      view: view(),
      draft: at([]),
      change: (d) => changes.push(d),
      send() {},
      hint,
      onHint: () => asked.push(1),
    });
    expect(node.querySelector(".hintline .cmds").textContent).toBe(
      'git add auth.js · git commit -m "feat(auth): rate-limit login attempts"',
    );
    expect(node.querySelector(".hintline .why").textContent).toBe("you build a commit");
    node.querySelector(".hintline .use").click();
    expect(changes[0].ops).toEqual([
      { op: "add", cards: ["k1"] },
      { op: "commit", message: "feat(auth): rate-limit login attempts" },
    ]);
    node.querySelector(".actions .hint").click();
    expect(asked).toEqual([1]);
  });

  it("offers to replace a pack already sent today", () => {
    const v = view({ sent_today: ["ana", "bot"] });
    expect(render(v).node.querySelector(".send").textContent).toBe("replace today's pack");
  });
});

it("fans the hand in one row while every card keeps a finger's width, and in two rows past that", () => {
  // a phone's 343 px: six cards fit in one row, seven need two
  expect(fanLayout(6, 343)).toEqual({ rows: 1, perRow: 6, overlap: 47 });
  expect(fanLayout(7, 343)).toEqual({ rows: 2, perRow: 4, overlap: 14 });
  expect(fanLayout(10, 343)).toMatchObject({ rows: 2, perRow: 5 });
  expect(fanLayout(10, 343).overlap).toBeLessThanOrEqual(96 - 44);
  // few cards on a wide screen don't overlap at all
  expect(fanLayout(3, 608).overlap).toBe(0);
});
