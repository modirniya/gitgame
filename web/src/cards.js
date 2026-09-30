// Cards as the printed deck draws them (event-screens §4): a colored band per file, the file name, a big +N, a red BUG
// tag on the face. Colors and command names come from rules/deck.json, the same data the tabletop PDF is built from;
// anything that changes play (costs, budgets) comes from the remote's view instead, since a game keeps its own rules.
import deck from "../../rules/deck.json";
import { el } from "./dom.js";

const colors = Object.fromEntries(deck.files.map((f) => [f.name, f.color]));
const commands = Object.fromEntries(deck.command_cards.map((c) => [c.id, c]));

export const commandName = (id) => commands[id]?.name ?? id;
export const commandText = (id) => commands[id]?.text ?? "";
export const fileColor = (file) => colors[file] ?? "var(--muted)";

/** A card in a hand: a commit card (file, lines, bug) or a command card. */
export function card(c, { size = "hand", selected = false, onclick } = {}) {
  const props = {
    class: `card ${size}${selected ? " selected" : ""}`,
    "data-id": c.id,
    // the face is drawn for the eye; a screen reader gets it in words
    "aria-label": c.kind === "command" ? commandName(c.command) : `${c.file} +${c.lines}${c.bug ? ", bug" : ""}`,
    "aria-pressed": onclick ? String(selected) : null,
    onclick,
  };
  const tag = onclick ? "button" : "div";

  if (c.kind === "command")
    return el(
      tag,
      { ...props, class: `${props.class} command`, title: commandText(c.command) },
      el("span", { class: "band" }),
      el("span", { class: "file" }, "command"),
      el("span", { class: "big" }, commandName(c.command)),
    );

  return el(
    tag,
    { ...props, style: `--band: ${fileColor(c.file)}` },
    el("span", { class: "band" }),
    el("span", { class: "file" }, c.file),
    el("span", { class: "big" }, `+${c.lines}`),
    c.bug && el("span", { class: "bug" }, "BUG"),
  );
}

/** A commit on `main` as the table sees it: face-down until flipped, with what was announced when it was pushed. */
export function commit(c, { tip = false, onclick, pickable = false } = {}) {
  if (c.initial) return el("div", { class: "card strip initial" }, el("span", { class: "big" }, "init"));

  // a bug stops counting once it is reverted, or crossed out by someone's `-X ours` (round-resolution §3)
  const live = c.bug && !c.reverted && !c.overwritten;
  const state = [
    c.flipped ? (live ? "bug" : "clean") : "down",
    c.reverted && "reverted",
    c.overwritten && "overwritten",
    c.revert_of && "revert",
    tip && "tip",
    pickable && "pickable",
  ].filter(Boolean);

  return el(
    onclick ? "button" : "div",
    {
      class: `card strip ${state.join(" ")}`,
      style: `--band: ${fileColor(c.files?.[0])}`,
      "data-id": c.id,
      title: c.message,
      "aria-label": `${c.id} by ${c.author}: ${(c.files ?? []).join(" ")} +${c.lines}, ${state[0] === "down" ? "face-down" : state[0]}`,
      onclick,
    },
    el("span", { class: "band" }),
    el("span", { class: "file" }, c.revert_of ? "revert" : (c.files ?? []).join(" ")),
    el("span", { class: "big" }, c.revert_of ? "↺" : `+${c.lines}`),
    el("span", { class: "author" }, c.author),
    c.flipped && live && el("span", { class: "bug" }, "BUG"),
  );
}
