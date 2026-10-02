// Cards as the printed deck draws them (event-screens §4): a colored band with what kind of card it is, the file in
// monospace, a big +N, and a red BUG tag at the top left, the one corner an overlapping hand never covers. One
// component at every size (`size`: sm, md, lg, xl). Colors and command names come from rules/deck.json, the same data
// the tabletop PDF is built from; anything that changes play (costs, budgets) comes from the remote's view instead.
import deck from "../../rules/deck.json";
import { el } from "./dom.js";

const colors = Object.fromEntries(deck.files.map((f) => [f.name, f.color]));
const commands = Object.fromEntries(deck.command_cards.map((c) => [c.id, c]));

export const commandName = (id) => commands[id]?.name ?? id;
export const commandText = (id) => commands[id]?.text ?? "";
export const fileColor = (file) => colors[file] ?? "var(--faint)";

// A command's name as it may wrap on a narrow card: at its spaces, never inside a flag (`push --force`, not `push --`).
const words = (name) =>
  name.split(" ").flatMap((w, i) => [i > 0 && " ", w.startsWith("-") ? el("span", { class: "flag" }, w) : w]);

/** A card in a hand: a commit card (file, lines, bug) or a command card. `used`: already spent by the pack. */
export function card(c, { size = "lg", selected = false, used = false, onclick } = {}) {
  const props = {
    class: ["card", size, c.kind === "command" && "command", selected && "selected", used && "used"]
      .filter(Boolean)
      .join(" "),
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
      { ...props, title: commandText(c.command) },
      el("span", { class: "band" }, "command"),
      el("span", { class: "face" }, el("span", { class: "name" }, words(commandName(c.command)))),
    );

  return el(
    tag,
    { ...props, style: `--band: ${fileColor(c.file)}` },
    el("span", { class: "band" }, "commit"),
    el("span", { class: "face" }, el("span", { class: "file" }, c.file), el("span", { class: "big" }, `+${c.lines}`)),
    c.bug && el("span", { class: "bug" }, "BUG"),
  );
}

/**
 * A commit as the table sees it: face-down (a hatch with its hash) until flipped, or `faceUp` for your own unpushed
 * commits. It has both sides, so a flip can turn it in place: the face shows only what was announced when it was
 * pushed (files and lines) plus, once flipped, whether it is a bug.
 */
export function commit(c, { size = "md", tip = false, onclick, pickable = false, faceUp = false } = {}) {
  if (c.initial)
    return el(
      "div",
      { class: `card ${size} initial`, "aria-label": "the initial commit" },
      el("span", { class: "band" }, "main"),
      el("span", { class: "face" }, el("span", { class: "file" }, "initial commit")),
    );

  // a bug stops counting once it is reverted, or crossed out by someone's keep-mine (round-resolution §3)
  const up = c.flipped || faceUp;
  const live = c.bug && !c.reverted && !c.overwritten;
  const state = [
    up ? (live ? "bug" : "clean") : "down",
    up && "up",
    c.reverted && "reverted",
    c.overwritten && "overwritten",
    c.revert_of && "revert",
    tip && "tip",
    pickable && "pickable",
  ].filter(Boolean);
  const files = c.files ?? [];

  return el(
    onclick ? "button" : "div",
    {
      class: `card ${size} commit ${state.join(" ")}`,
      style: `--band: ${c.revert_of ? "var(--ok)" : fileColor(files[0])}`,
      "data-id": c.id,
      title: c.message,
      "aria-label": `${c.id} by ${c.author}: ${files.join(" ")} +${c.lines}, ${up ? state[0] : "face-down"}`,
      onclick,
    },
    el(
      "span",
      { class: "flipper" },
      el("span", { class: "side back" }, el("span", { class: "sha" }, c.id)),
      el(
        "span",
        { class: "side front" },
        el("span", { class: "band" }, c.revert_of ? "revert" : "commit"),
        el(
          "span",
          { class: "face" },
          el("span", { class: "file" }, c.revert_of ?? files.join(" ")),
          el("span", { class: "big" }, c.revert_of ? "↺" : `+${c.lines}`),
        ),
        up && live && el("span", { class: "bug" }, "BUG"),
      ),
    ),
  );
}
