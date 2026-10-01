// Moments as a terminal shows them: each op a prompt line, `ana@main $ git push`, and Git's output beneath it. This is
// the day log's routine form, the lines between the screens; one moment's transcript is also the top of its screen.
import { el } from "./dom.js";

/**
 * One moment's lines. A moment that isn't a command (a draw, an absence) is a comment, `# raj sent no pack today`, as
 * a shell would print it; one with nothing to print (the incident, CI) is left to its screen.
 */
export function lines(m, you, { why = true } = {}) {
  const mine = m.player === you;
  const cls = `lines${m.tone ? ` ${m.tone}` : ""}${mine ? " mine" : ""}`;

  if (!m.command)
    return m.output.length
      ? el("div", { class: cls }, el("div", { class: "note" }, `# ${mine ? "you" : m.player} ${m.output.join("; ")}`))
      : null;

  return el(
    "div",
    { class: cls },
    el("div", { class: "prompt" }, el("span", { class: "who" }, `${m.player}@main`), " $ ", m.command),
    m.output.map((line) => el("div", { class: "out" }, line)),
    (m.notes ?? []).map((note) => el("div", { class: "note" }, `# ${note}`)),
    why && m.why && el("div", { class: "note" }, `# ${m.why}`),
  );
}

export function transcript(ms, you, { label = "day log" } = {}) {
  return el(
    "section",
    { class: "transcript", "aria-label": label },
    ms.length ? ms.map((m) => lines(m, you)) : el("div", { class: "note" }, "# nothing happened"),
  );
}
