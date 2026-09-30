// I-Hub (event-screens §3): where a day's pack is written. `main` at the top, your branch and hand below, one row of
// actions each saying why when it can't be played, and the pack as a list of commands with what each will cost. The
// hub holds nothing: it renders a view and a draft (`{ops, selected, picking}`), and hands every change to `change`.
import { el } from "./dom.js";
import { card, commandName, commit } from "./cards.js";
import { strip } from "./table.js";
import { actions, add, price } from "./pack.js";

/** An op as the command a terminal would show. */
export function command(op, view) {
  const hand = view.you.hand;
  switch (op.op) {
    case "add":
      return `git add ${[...new Set(op.cards.map((id) => hand.find((c) => c.id === id)?.file ?? id))].join(" ")}`;
    case "commit":
      return `git commit -m ${JSON.stringify(op.message ?? "")}`;
    case "pull":
      return ["git pull", op.rebase && "--rebase", op.strategy && `-X ${op.strategy}`].filter(Boolean).join(" ");
    case "push":
      return "git push";
    case "force":
      return "git push --force";
    case "blame":
      return `git blame ${op.target}`;
    case "revert":
      return `git revert ${op.target}`;
    case "tag":
      return "git tag -a v1.0";
    case "arm":
      return `# arm ${commandName(op.trap)}, face-down`;
  }
}

// Your own commits, face-up to you (bug and all), as they would look on main.
const own = (c) => ({
  id: c.id,
  author: c.author,
  message: c.message,
  files: [...new Set(c.cards.map((k) => k.file))],
  lines: c.cards.reduce((n, k) => n + k.lines, 0),
  flipped: true,
  bug: c.cards.some((k) => k.bug),
});

/** Your branch: what you have committed and not pushed, and what is staged for the next commit. */
function branch(view) {
  const { local, staged } = view.you;
  if (!local.length && !staged.length) return null;
  return el(
    "section",
    { class: "branch", "aria-label": "your branch" },
    el("h2", {}, `your branch · ${local.length} to push`),
    local.length > 0 &&
      el(
        "ol",
        { class: "strip" },
        local.map((c) => el("li", {}, commit(own(c)))),
      ),
    staged.length > 0 &&
      el(
        "div",
        { class: "cards staged" },
        el("span", {}, "staged"),
        staged.map((c) => card(c)),
      ),
  );
}

const range = (r) => (r.cost === r.most ? `${r.cost}` : `${r.cost}–${r.most}`);

function row(view, draft, change, r, i) {
  const set = (patch) => change({ ...draft, ops: draft.ops.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
  const remove = () => change({ ...draft, ops: draft.ops.filter((_, j) => j !== i) });
  const op = r.op;

  return el(
    "li",
    { class: `op${r.runs ? "" : " over"}${r.maybe ? " maybe" : ""}` },
    el("span", { class: "cmd" }, command(op, view)),
    el("span", { class: "cost", title: "ops this costs: now, or at most" }, range(r)),
    el("button", { class: "remove", "aria-label": `remove ${command(op, view)}`, onclick: remove }, "×"),
    op.op === "commit" &&
      el("input", {
        class: "message",
        "aria-label": "commit message",
        placeholder: "commit message",
        maxlength: 200,
        value: op.message ?? "",
        onchange: (e) => set({ message: e.target.value }),
      }),
    op.op === "pull" &&
      el(
        "span",
        { class: "flags" },
        el(
          "label",
          {},
          el("input", {
            type: "checkbox",
            "aria-label": "--rebase",
            checked: !!op.rebase,
            onchange: (e) => set({ rebase: e.target.checked }),
          }),
          " --rebase",
        ),
        el(
          "select",
          { "aria-label": "on a conflict", onchange: (e) => set({ strategy: e.target.value || undefined }) },
          el("option", { value: "" }, `-X ${view.default_strategy} (default)`),
          ["ours", "theirs", "resolve"].map((x) => el("option", { value: x, selected: op.strategy === x }, `-X ${x}`)),
        ),
      ),
    el("span", { class: "note" }, r.runs ? r.note : "not run: over budget", r.maybe ? " · may not run" : ""),
  );
}

export function hub({ view, draft, change, send, sending = false, error = "" }) {
  const priced = price(view, draft.ops);
  const can = actions(view, draft.ops, draft.selected);
  const put = (op) => change({ ...draft, ops: add(view, draft.ops, op), selected: [], picking: null });
  const sent = view.sent_today.includes(view.you.player);

  const action = (key, label, op) =>
    el(
      "button",
      {
        class: "action",
        disabled: !!can[key],
        title: can[key] ?? "",
        onclick: () => (op ? put(op()) : change({ ...draft, picking: key })),
      },
      label,
      can[key] && el("span", { class: "why" }, can[key]),
    );

  const inHand = new Set(priced.left.hand.map((c) => c.id));
  const toggle = (id) =>
    change({
      ...draft,
      selected: draft.selected.includes(id) ? draft.selected.filter((x) => x !== id) : [...draft.selected, id],
    });

  const picking = draft.picking;
  const pickable = (c) =>
    picking === "blame"
      ? !c.initial && !c.revert_of && !c.flipped && c.author !== view.you.player
      : picking === "revert" && c.flipped && c.bug && !c.reverted && !c.overwritten;

  return el(
    "section",
    { class: "hub", "aria-label": "write your pack" },
    el(
      "header",
      { class: "status" },
      el("span", {}, `day ${view.day}/${view.final_day}`),
      el("span", {}, `main ${view.main.length - 1}/${view.release_at}`),
      el(
        "span",
        { class: "budget", title: "ops the pack spends now, of today's budget" },
        `ops ${priced.spent}/${view.budget}`,
      ),
      view.incident && el("span", { class: "incident", title: view.incident.text }, view.incident.name),
    ),
    strip(view, { pickable: picking ? pickable : () => false, onpick: (c) => put({ op: picking, target: c.id }) }),
    picking &&
      el(
        "p",
        { class: "picking" },
        `git ${picking}: pick a commit on main `,
        el("button", { onclick: () => change({ ...draft, picking: null }) }, "cancel"),
      ),
    branch(view),
    el(
      "div",
      { class: "cards", "aria-label": "your hand" },
      view.you.hand.map((c) =>
        inHand.has(c.id)
          ? card(c, {
              selected: draft.selected.includes(c.id),
              onclick: c.kind === "commit" ? () => toggle(c.id) : null,
            })
          : card(c, { size: "hand used" }),
      ),
    ),
    el(
      "div",
      { class: "actions" },
      action("add", "add", () => ({ op: "add", cards: draft.selected.filter((id) => inHand.has(id)) })),
      action("commit", "commit", () => ({ op: "commit", message: "" })),
      action("pull", "pull", () => ({ op: "pull" })),
      action("push", "push", () => ({ op: "push" })),
      action("blame", "blame"),
      action("revert", "revert"),
      action("force", "push --force", () => ({ op: "force" })),
      action("arm", "arm reflog", () => ({ op: "arm", trap: "reflog" })),
      action("tag", "tag v1.0", () => ({ op: "tag" })),
    ),
    el(
      "ol",
      { class: "pack", "aria-label": "your pack" },
      priced.rows.length
        ? priced.rows.map((r, i) => row(view, draft, change, r, i))
        : el("li", { class: "empty" }, "# an empty pack: nothing happens, and two in a row leaves the company"),
    ),
    el("p", { class: "error", role: "alert" }, error),
    el(
      "button",
      { class: "primary send", disabled: sending, onclick: send },
      sending ? "sending…" : sent ? "replace today's pack" : "send pack",
    ),
  );
}
