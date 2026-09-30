// A replay (Phase 1 exit: "replayed from its log"): any game, day by day, as the table saw it. Each day is the view the
// remote folds from the log up to that day's close (GET /api/games/:id/days/:day), so the replay is the game's own
// record, not a recording the client kept: `main` as it stood, every seat, and that day's log as a terminal.
import { el, mount } from "./dom.js";
import { table } from "./table.js";
import { moments } from "./moments.js";
import { transcript } from "./transcript.js";

export function replayScreen({ remote, go, id, day }) {
  const node = el("section", { class: "screen replay" });
  let alive = true;
  let last = null;

  const to = (n) => go(`/r/${id}/${n}`);

  function render(view) {
    const log = view.days.at(-1);
    const ms = day > 0 && log ? moments(log.log, { you: null }).moments : [];

    mount(
      node,
      el("h1", {}, "git log --reverse"),
      el(
        "nav",
        { class: "replay-nav", "aria-label": "days" },
        el("button", { disabled: day === 0, onclick: () => to(day - 1), "aria-label": "the day before" }, "←"),
        el("span", {}, day === 0 ? "as created" : `after day ${day} of ${last}`),
        el("button", { disabled: day >= last, onclick: () => to(day + 1), "aria-label": "the day after" }, "→"),
      ),
      table(view),
      day > 0 && transcript(ms, null, { label: `day ${day}` }),
      view.released && day === last && el("p", {}, `v1.0 shipped on day ${view.released.day}.`),
      el("p", {}, el("a", { href: "#/" }, "new game")),
    );
  }

  function fail(e) {
    mount(node, el("p", { class: "error", role: "alert" }, e.message), el("a", { href: "#/" }, "new game"));
  }

  // ← and → step through the days
  function key(e) {
    if (last == null) return;
    if (e.key === "ArrowLeft" && day > 0) to(day - 1);
    if (e.key === "ArrowRight" && day < last) to(day + 1);
  }

  mount(node, el("p", { class: "muted" }, "$ git fetch"));
  document.addEventListener("keydown", key);

  remote
    .fetchView(id)
    .then((now) => {
      last = now.days.length;
      day = Math.min(day, last);
      return remote.fetchDay(id, day);
    })
    .then((view) => alive && render(view), fail);

  return {
    node,
    leave: () => {
      alive = false;
      document.removeEventListener("keydown", key);
    },
  };
}
