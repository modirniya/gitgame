// The icons: one family (design-system/gitgame/MASTER.md §3), drawn on a 24-unit grid in 2 px round strokes and shown
// at 20 px. Decorative unless given a `label`, which becomes its accessible name.
const PATHS = {
  check: "M5 12l5 5 9-10",
  copy: "M9 9h11v11H9zM5 15V6a2 2 0 0 1 2-2h8",
  left: "M15 6l-6 6 6 6",
  right: "M9 6l6 6-6 6",
  down: "M6 9l6 6 6-6",
  close: "M6 6l12 12M18 6L6 18",
};
const NS = "http://www.w3.org/2000/svg";

/** An inline SVG icon by name; `label` names it for a screen reader, otherwise it is hidden from one. */
export function icon(name, { label } = {}) {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "icon");
  svg.setAttribute("viewBox", "0 0 24 24");
  if (label) {
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", label);
  } else svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(NS, "path");
  path.setAttribute("d", PATHS[name]);
  svg.append(path);
  return svg;
}
