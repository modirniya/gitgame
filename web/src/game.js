// A game as one player sees it: fetch the view, render it, send packs. Opening a game a second later or a week later is
// the same thing (charter decision 9), so what this screen keeps is only the last view it fetched and the pack being
// written against it; when a new day's view arrives, a draft for the old one is dropped, as the remote would refuse it.
import { el, mount } from "./dom.js";
import { table } from "./table.js";
import { hub } from "./hub.js";
import { moments } from "./moments.js";
import { transcript } from "./transcript.js";

const fresh = () => ({ ops: [], selected: [], picking: null });

export function gameScreen({ remote, id, player }) {
  const node = el("section", { class: "screen game" });
  let alive = true;
  let s = { view: null, draft: fresh(), sending: false, error: "", tableOpen: false };

  function set(patch) {
    s = { ...s, ...patch };
    if (alive && s.view) render();
  }

  async function fetchView(error = "") {
    try {
      const view = await remote.fetchView(id, player);
      const moved = !s.view || view.version !== s.view.version;
      set({ view, error, draft: moved ? fresh() : s.draft });
    } catch (e) {
      if (!s.view) return fail(e);
      set({ error: e.message });
    }
  }

  async function send() {
    set({ sending: true, error: "" });
    try {
      await remote.sendPack(id, { player, version: s.view.version, ops: s.draft.ops });
      set({ sending: false });
      await fetchView();
    } catch (e) {
      set({ sending: false });
      // stale: the day closed while this pack was written; what it was written against is gone
      if (e.stale) await fetchView(`${e.message}\nThe day closed while you wrote. Here is the new one.`);
      else set({ error: e.message });
    }
  }

  function render() {
    const view = s.view;
    const last = view.days.at(-1);
    const log = last && moments(last.log, { you: player }).moments;

    mount(
      node,
      view.released
        ? el("p", { class: "released" }, "v1.0 has shipped: the game is over.")
        : hub({
            view,
            draft: s.draft,
            change: (draft) => set({ draft }),
            send,
            sending: s.sending,
            error: s.error,
          }),
      el(
        "button",
        {
          class: "table-toggle",
          "aria-expanded": String(s.tableOpen),
          onclick: () => set({ tableOpen: !s.tableOpen }),
        },
        s.tableOpen ? "close the table" : "the table",
      ),
      el(
        "aside",
        { class: `table-panel${s.tableOpen ? " open" : ""}` },
        table(view),
        log && el("h2", {}, `$ git log  # day ${last.day}`),
        log && transcript(log, player, { label: `day ${last.day}` }),
      ),
    );
  }

  // Enter sends the pack, Escape backs out of whatever is open (event-screens §4), unless a field has the keyboard.
  function key(e) {
    if (!s.view || e.target.closest?.("input, select, textarea")) return;
    if (e.key === "Escape") set({ draft: { ...s.draft, picking: null }, tableOpen: false });
    // a focused button answers Enter itself
    if (e.key === "Enter" && !e.target.closest?.("button") && !s.view.released && !s.sending) send();
  }

  function fail(e) {
    mount(node, el("p", { class: "error", role: "alert" }, e.message), el("a", { href: "#/" }, "new game"));
  }

  document.addEventListener("keydown", key);
  mount(node, el("p", { class: "muted" }, "$ git fetch"));
  fetchView();

  return {
    node,
    leave: () => {
      alive = false;
      document.removeEventListener("keydown", key);
    },
  };
}
