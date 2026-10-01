// The pack being written, as the receipt a terminal would print (event-screens §9: I-Hub writes a pack): each op as
// its command, what it costs now and at most, and what it will do; a commit's message with others to pick, a pull's
// flags. The model behind it is pack.js; this only draws it and hands every change to `change`.
import { el } from "./dom.js";
import { commandName } from "./cards.js";
import { gitFlag, STRATEGIES } from "./pack.js";
import { suggestions } from "./messages.js";

/** An op as the command a terminal would show. */
export function command(op, view) {
  const hand = view.you.hand;
  switch (op.op) {
    case "add":
      return `git add ${[...new Set(op.cards.map((id) => hand.find((c) => c.id === id)?.file ?? id))].join(" ")}`;
    case "commit":
      return `git commit -m ${JSON.stringify(op.message ?? "")}`;
    case "pull":
      return ["git pull", op.rebase && "--rebase", gitFlag(op.strategy ?? view.default_strategy, op.rebase)]
        .filter(Boolean)
        .join(" ");
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

const range = (r) => (r.cost === r.most ? `${r.cost}` : `${r.cost}–${r.most}`);

function row(view, draft, change, r, i) {
  const set = (patch) => change({ ...draft, ops: draft.ops.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
  const remove = () => change({ ...draft, ops: draft.ops.filter((_, j) => j !== i) });
  const op = r.op;

  const cmd = el("span", { class: "cmd" }, command(op, view));
  // No re-render while a message is written: one when the field lost focus replaced the send button under the very
  // tap that took the focus away, and the pack wasn't sent.
  const write = (message) => {
    op.message = message;
    cmd.textContent = command(op, view);
  };
  const field =
    op.op === "commit" &&
    el("input", {
      class: "message",
      "aria-label": "commit message",
      placeholder: "commit message",
      maxlength: 200,
      value: op.message ?? "",
      oninput: (e) => write(e.target.value),
    });

  return el(
    "li",
    { class: `op${r.runs ? "" : " over"}${r.maybe ? " maybe" : ""}` },
    cmd,
    el("span", { class: "cost", title: "ops this costs: now, or at most" }, range(r)),
    el("button", { class: "remove", "aria-label": `remove ${command(op, view)}`, onclick: remove }, "×"),
    field,
    op.op === "commit" &&
      el(
        "span",
        { class: "suggestions" },
        suggestions(r.cards)
          .filter((text) => text !== op.message)
          .map((text) =>
            el(
              "button",
              { class: "suggestion", type: "button", onclick: () => ((field.value = text), write(text)) },
              text,
            ),
          ),
      ),
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
          el("option", { value: "" }, `on a conflict: ${STRATEGIES[view.default_strategy]}`),
          ["theirs", "ours", "resolve"]
            .filter((x) => x !== view.default_strategy)
            .map((x) => el("option", { value: x, selected: op.strategy === x }, `on a conflict: ${STRATEGIES[x]}`)),
        ),
      ),
    el("span", { class: "note" }, r.runs ? r.note : "not run: over budget", r.maybe ? " · may not run" : ""),
  );
}

/** The pack's rows, from `priced` (`price(view, draft.ops)`). */
export function packList(view, draft, change, priced) {
  return el(
    "ol",
    { class: "pack", "aria-label": "your pack" },
    priced.rows.length
      ? priced.rows.map((r, i) => row(view, draft, change, r, i))
      : el("li", { class: "empty" }, "# an empty pack: nothing happens, and two in a row leaves the company"),
  );
}
