// I-Hub (event-screens §3): where a day's pack is written. `main` at the top, your branch and hand below, one row of
// actions each saying why when it can't be played, and the pack as a list of commands with what each will cost. The
// hub holds nothing: it renders a view and a draft (`{ops, selected, picking}`), and hands every change to `change`,
// except a commit message, which is written into its op as it is typed (see `row`).
import { el } from "./dom.js";
import { card, commandName, commit } from "./cards.js";
import { strip } from "./table.js";
import { actions, add, consequences, price, unspent } from "./pack.js";

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

// A hand card is 96 px wide; a fanned one shows at least this much of itself, a finger's width.
const CARD = 96;
const TAP = 44;

/**
 * How the hand fans on a screen `width` wide: the cards in each row, and how much each overlaps the one before. One
 * row if every card keeps TAP pixels to tap, otherwise two.
 */
export function fanLayout(n, width) {
  const step = (count) => (count > 1 ? Math.min(CARD + 8, (width - CARD) / (count - 1)) : CARD + 8);
  const rows = n > 1 && step(n) < TAP ? 2 : 1;
  const perRow = Math.ceil(n / rows);
  return { rows, perRow, overlap: Math.max(0, CARD - Math.floor(step(perRow))) };
}

function fan(cards) {
  const width = Math.min(globalThis.innerWidth || 640, 640) - 32;
  const { perRow, overlap } = fanLayout(cards.length, width);
  const rows = [];
  for (let i = 0; i < cards.length; i += perRow) rows.push(cards.slice(i, i + perRow));
  return el(
    "div",
    { class: "hand-rows", "aria-label": "your hand" },
    rows.map((row) => el("div", { class: "hand-fan", style: `--overlap: ${overlap}px` }, row)),
  );
}

const range = (r) => (r.cost === r.most ? `${r.cost}` : `${r.cost}–${r.most}`);

function row(view, draft, change, r, i) {
  const set = (patch) => change({ ...draft, ops: draft.ops.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
  const remove = () => change({ ...draft, ops: draft.ops.filter((_, j) => j !== i) });
  const op = r.op;

  const cmd = el("span", { class: "cmd" }, command(op, view));

  return el(
    "li",
    { class: `op${r.runs ? "" : " over"}${r.maybe ? " maybe" : ""}` },
    cmd,
    el("span", { class: "cost", title: "ops this costs: now, or at most" }, range(r)),
    el("button", { class: "remove", "aria-label": `remove ${command(op, view)}`, onclick: remove }, "×"),
    op.op === "commit" &&
      el("input", {
        class: "message",
        "aria-label": "commit message",
        placeholder: "commit message",
        maxlength: 200,
        value: op.message ?? "",
        // No re-render: one when the field lost focus replaced the send button under the very tap that took the
        // focus away, and the pack wasn't sent.
        oninput: (e) => {
          op.message = e.target.value;
          cmd.textContent = command(op, view);
        },
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

// the action buttons' names, which the warning about unspent ops repeats
const LABELS = {
  add: "add",
  commit: "commit",
  pull: "pull",
  push: "push",
  blame: "blame",
  revert: "revert",
  force: "push --force",
  arm: "arm reflog",
  tag: "tag v1.0",
};

/** `warned`: the send button was tapped with ops left unspent, so the hub says what could still be done. */
export function hub({ view, draft, change, send, sending = false, error = "", warned = false }) {
  const priced = price(view, draft.ops);
  const unused = warned && unspent(view, draft.ops);
  const can = actions(view, draft.ops, draft.selected);
  const will = consequences(view, draft.ops, draft.selected);
  const put = (op) => change({ ...draft, ops: add(view, draft.ops, op), selected: [], picking: null });
  const sent = view.sent_today.includes(view.you.player);

  const action = (key, op) =>
    el(
      "button",
      {
        class: "action",
        "data-guide": key,
        disabled: !!can[key],
        title: can[key] ?? "",
        onclick: () => (op ? put(op()) : change({ ...draft, picking: key })),
      },
      LABELS[key],
      // what it would do, in your situation; or, when it can't be played, why not
      can[key] ? el("span", { class: "why" }, can[key]) : will[key] && el("span", { class: "will" }, will[key]),
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
    fan(
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
      action("add", () => ({ op: "add", cards: draft.selected.filter((id) => inHand.has(id)) })),
      action("commit", () => ({ op: "commit", message: "" })),
      action("pull", () => ({ op: "pull" })),
      action("push", () => ({ op: "push" })),
      action("blame"),
      action("revert"),
      action("force", () => ({ op: "force" })),
      action("arm", () => ({ op: "arm", trap: "reflog" })),
      action("tag", () => ({ op: "tag" })),
    ),
    el(
      "ol",
      { class: "pack", "aria-label": "your pack" },
      priced.rows.length
        ? priced.rows.map((r, i) => row(view, draft, change, r, i))
        : el("li", { class: "empty" }, "# an empty pack: nothing happens, and two in a row leaves the company"),
    ),
    unused &&
      el(
        "p",
        { class: "unspent", role: "alert" },
        `# ${unused.left} of today's ${view.budget} ops unspent: you could still ${unused.moves.map((k) => LABELS[k]).join(", ")}`,
      ),
    el("p", { class: "error", role: "alert" }, error),
    el(
      "button",
      { class: "primary send", "data-guide": "send", disabled: sending, onclick: send },
      sending ? "sending…" : unused ? "send anyway" : sent ? "replace today's pack" : "send pack",
    ),
  );
}
