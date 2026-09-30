// A game as one player sees it. Fetch the view, show what happened since this reader last looked (one screen per big
// moment), then the hub to write a pack. Opening a game a second later or a week later is the same thing (charter
// decision 9): this screen keeps only the last view it fetched and the pack being written against it, and the remote's
// live stream only ever says "fetch again". When a new day's view arrives, a draft for the old one is dropped, as the
// remote would refuse it.
import { el, mount } from "./dom.js";
import { table } from "./table.js";
import { hub } from "./hub.js";
import { moments } from "./moments.js";
import { transcript } from "./transcript.js";
import { momentScreen } from "./screens.js";
import { catchup, recall, remember } from "./catchup.js";

const fresh = () => ({ ops: [], selected: [], picking: null });

// Hotseat (until sign-in, M8): the people at this device who still owe today's pack.
const waiting = (view) =>
  view.seats.filter(
    (id) =>
      id !== view.you.player && !view.bots.includes(id) && !view.players[id].left && !view.sent_today.includes(id),
  );

export function gameScreen({ remote, go, id, player }) {
  const node = el("section", { class: "screen game" });
  let alive = true;
  let s = { view: null, draft: fresh(), sending: false, error: "", tableOpen: false, queue: [], at: 0, handoff: null };
  let pending = null;

  function set(patch) {
    s = { ...s, ...patch };
    if (alive && s.view) render();
  }

  async function fetchView(error = "") {
    try {
      const view = await remote.fetchView(id, player);
      const moved = !s.view || view.version !== s.view.version;
      const next = catchup(view, recall(id, player));
      pending = next.memory;
      set({ view, error, draft: moved ? fresh() : s.draft, queue: next.queue, at: Math.min(s.at, next.queue.length) });
    } catch (e) {
      if (!s.view) return fail(e);
      set({ error: e.message });
    }
  }

  // Done with the moments: remember how far this reader has read, and go to the hub.
  function caughtUp() {
    remember(id, player, pending);
    set({ queue: [], at: 0 });
  }

  async function send() {
    set({ sending: true, error: "" });
    try {
      await remote.sendPack(id, { player, version: s.view.version, ops: s.draft.ops });
      const version = s.view.version;
      await fetchView();
      set({ sending: false, handoff: s.view.version === version ? (waiting(s.view)[0] ?? null) : null });
    } catch (e) {
      set({ sending: false });
      // stale: the day closed while this pack was written; what it was written against is gone
      if (e.stale) await fetchView(`${e.message}\nThe day closed while you wrote. Here is the new one.`);
      else set({ error: e.message });
    }
  }

  function render() {
    if (s.queue.length && s.at < s.queue.length) {
      const next = () => (s.at + 1 < s.queue.length ? set({ at: s.at + 1 }) : caughtUp());
      const step = { at: s.at + 1, of: s.queue.length };
      return mount(node, momentScreen(s.queue[s.at], { view: s.view, you: player, step, next, skip: caughtUp }));
    }
    if (s.handoff) return mount(node, handoff(s.handoff));

    const view = s.view;
    const last = view.days.at(-1);
    const log = last && moments(last.log, { you: player }).moments;

    mount(
      node,
      view.released
        ? scoreboard(view)
        : hub({ view, draft: s.draft, change: (draft) => set({ draft }), send, sending: s.sending, error: s.error }),
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

  // O-Handoff: the pack is in; the hand leaves the screen before the device changes hands.
  function handoff(next) {
    return el(
      "section",
      { class: "screen handoff" },
      el("h1", {}, "pack sent"),
      el("p", {}, `Pass the device to ${next}. Your hand is hidden until you come back to it.`),
      el("button", { class: "primary", onclick: () => go(`/g/${id}/${encodeURIComponent(next)}`) }, `I'm ${next}`),
      el("button", { onclick: () => set({ handoff: null }) }, `back to ${player}'s pack`),
    );
  }

  // Enter continues or sends, Escape backs out of whatever is open (event-screens §4), unless a field has the keyboard.
  function key(e) {
    if (!s.view || e.target.closest?.("input, select, textarea")) return;
    if (s.queue.length || s.handoff) return;
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
  const stop = remote.live(id, () => fetchView());

  return {
    node,
    leave: () => {
      alive = false;
      stop();
      document.removeEventListener("keydown", key);
    },
  };
}

// O-Scoreboard: the totals, and the points each was made of (rules/deck.json scoring).
function scoreboard(view) {
  const rows = [...view.seats].sort((a, b) => view.scores[b].total - view.scores[a].total);
  const parts = (s) =>
    ["lines", "fixes", "blame", "sins", "grudges", "merge"]
      .filter((k) => s[k])
      .map((k) => `${k} ${s[k] > 0 ? "+" : ""}${s[k]}`);

  return el(
    "section",
    { class: "scoreboard" },
    el("h1", {}, "v1.0 shipped"),
    el(
      "p",
      { class: view.released.production_down ? "error" : "muted" },
      view.released.production_down ? "Production is down." : `${view.released.bugs} bugs reached production.`,
    ),
    el(
      "ol",
      { class: "seats" },
      rows.map((id) =>
        el(
          "li",
          { class: `seat${id === view.you.player ? " you" : ""}` },
          el("span", { class: "who" }, id),
          el("span", { class: "score" }, view.scores[id].total),
          el("span", { class: "facts" }, parts(view.scores[id]).join(" · ")),
        ),
      ),
    ),
    el("p", {}, el("a", { href: "#/" }, "new game")),
  );
}
