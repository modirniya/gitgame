// A game as one player sees it. Fetch the view, show what happened since this reader last looked (one screen per big
// moment), then the hub to write a pack. Opening a game a second later or a week later is the same thing (charter
// decision 9): this screen keeps only the last view it fetched and the pack being written against it, and the remote's
// live stream only ever says "fetch again". When a new day's view arrives, a draft for the old one is dropped, as the
// remote would refuse it.
import { el, mount } from "./dom.js";
import { table } from "./table.js";
import { frame } from "./frame.js";
import { hub } from "./hub.js";
import { price, unspent } from "./pack.js";
import { play, snapshot } from "./motion.js";
import { moments } from "./moments.js";
import { transcript } from "./transcript.js";
import { momentScreen } from "./screens.js";
import { catchup, recall, remember } from "./catchup.js";
import { nudge } from "./whoami.js";
import { offerReminders, remindButton } from "./remind.js";
import { whatDecidedIt } from "./verdict.js";
import { feedbackBox } from "./feedback.js";
import { guideLayer, guideStep, highlight, isGuided, setGuided } from "./guide.js";

const fresh = () => ({ ops: [], selected: [], picking: null });

// Hotseat: the other seats this device holds (ADR-0005) whose people still owe today's pack.
const waiting = (view) =>
  (view.yours ?? []).filter(
    (seat) => seat !== view.you.player && !view.players[seat].left && !view.sent_today.includes(seat),
  );

// `seat` is the one the address names, in a hotseat game; otherwise the remote shows this device's only seat, or the
// table's view if it holds none.
export function gameScreen({ remote, go, id, seat, me = null }) {
  const node = el("section", { class: "screen game" });
  let alive = true;
  let s = {
    view: null,
    draft: fresh(),
    sending: false,
    error: "",
    warned: false,
    tableOpen: false,
    queue: [],
    at: 0,
    handoff: null,
  };
  let pending = null;
  // made once, so re-rendering doesn't ask the browser again
  let remind = null;
  // and so is the feedback box, so a re-render doesn't throw away what is being typed in it
  let note = null;

  function set(patch) {
    s = { ...s, ...patch };
    if (alive && s.view) render();
  }

  async function fetchView(error = "") {
    try {
      const view = await remote.fetchView(id, seat);
      const moved = !s.view || view.version !== s.view.version;
      // the table's view has no one to catch up: it shows what happened, not what you missed
      const next = view.you ? catchup(view, recall(id, view.you.player)) : { queue: [], memory: null };
      pending = next.memory;
      set({
        view,
        error,
        draft: moved ? fresh() : s.draft,
        warned: moved ? false : s.warned,
        queue: next.queue,
        at: Math.min(s.at, next.queue.length),
      });
    } catch (e) {
      if (!s.view) return fail(e);
      set({ error: e.message });
    }
  }

  // Done with the moments: remember how far this reader has read, and go to the hub.
  function caughtUp() {
    if (pending) remember(id, s.view.you.player, pending);
    set({ queue: [], at: 0 });
  }

  async function send() {
    // A pack that leaves ops unspent goes on the second tap: the first has the hub say what could still be done.
    if (!s.warned && unspent(s.view, s.draft.ops)) return set({ warned: true });
    set({ sending: true, error: "", warned: false });
    try {
      await remote.sendPack(id, { seat: s.view.you.player, version: s.view.version, ops: s.draft.ops });
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

  // A bot's routine step moves on by itself after a moment (event-screens §5: 1.2 s); a tap moves on sooner.
  let auto = null;

  function render() {
    clearTimeout(auto);
    const view = s.view;
    const you = view.you?.player ?? null;
    // the pips count the ops your pack still leaves today, while there is a pack to write
    const writing = you && !view.released && !(s.queue.length && s.at < s.queue.length) && !s.handoff;
    const left = writing ? view.budget - Math.min(price(view, s.draft.ops).spent, view.budget) : null;
    const tableOpen = s.tableOpen;
    const onTable = () => set({ tableOpen: !tableOpen });

    // the hub drawn again after an op: keep the pack where it was scrolled to, and play what moved (M15e)
    const was = node.querySelector(".view.hub");
    const before = was && snapshot(was);
    const scrolled = was?.querySelector(".body").scrollTop ?? 0;
    mount(node, frame(view, { left, tableOpen, onTable }), screenFor(view, you), tablePanel(view, you, onTable));
    const now = node.querySelector(".view.hub");
    if (was && now) {
      now.querySelector(".body").scrollTop = scrolled;
      play(now, before);
    }
    if (writing) guide(view);
  }

  // What the frame holds: a moment of the days you haven't seen, the handoff, the scoreboard, or your pack to write.
  function screenFor(view, you) {
    if (s.queue.length && s.at < s.queue.length) {
      const next = () => (s.at + 1 < s.queue.length ? set({ at: s.at + 1 }) : caughtUp());
      const step = { at: s.at + 1, of: s.queue.length };
      const m = s.queue[s.at];
      if (m.bot) {
        const at = s.at;
        auto = setTimeout(() => alive && s.at === at && next(), 1200);
      }
      return momentScreen(m, { view, you, step, next, skip: caughtUp });
    }
    if (s.handoff) return handoff(s.handoff);
    if (view.released) return scoreboard(view, me, you && (note ??= feedbackBox(remote, id)));
    if (!you)
      return el(
        "section",
        { class: "view" },
        el(
          "div",
          { class: "body" },
          el("p", { class: "muted" }, "# you hold no seat in this game: this is what the table sees"),
        ),
      );
    return hub({
      view,
      draft: s.draft,
      change: (draft) => set({ draft, warned: false }),
      send,
      sending: s.sending,
      error: s.error,
      warned: s.warned,
      extra: offerReminders(view) && (remind ??= remindButton(remote)),
    });
  }

  // The Table: a sheet over the screen on a phone, opened from the frame; a panel beside the screen on a wide one, with
  // the last day's log as a transcript (event-screens §4).
  function tablePanel(view, you, close) {
    const last = view.days.at(-1);
    const log = last && moments(last.log, { you }).moments;
    return el(
      "aside",
      { class: `table-panel${s.tableOpen ? " open" : ""}`, "aria-label": "the table" },
      el(
        "div",
        { class: "sheet-head" },
        el("h2", {}, "the table"),
        el("button", { class: "close", onclick: close }, "close"),
      ),
      table(view),
      log && el("h2", {}, `$ git log  # day ${last.day}`),
      log && transcript(log, you, { label: `day ${last.day}` }),
    );
  }

  // The guided first game (M14d): one sentence and one highlighted thing over the hub, until done or skipped.
  function guide(view) {
    if (!isGuided(id)) return;
    const step = guideStep(view, s.draft);
    if (!step) return setGuided(id, false);
    // at the top of the pack being written, where it covers nothing the guide asks for
    node.querySelector(".hub > .body")?.prepend(guideLayer(step, { done: () => (setGuided(id, false), render()) }));
    highlight(node, step.target);
  }

  // O-Handoff: the pack is in; the hand leaves the screen before the device changes hands.
  function handoff(next) {
    return el(
      "section",
      { class: "view handoff" },
      el(
        "div",
        { class: "body" },
        el("h1", {}, "pack sent"),
        el("p", {}, `Pass the device to ${next}. Your hand is hidden until you come back to it.`),
      ),
      el(
        "div",
        { class: "actions stack" },
        el("button", { class: "primary", onclick: () => go(`/g/${id}/${encodeURIComponent(next)}`) }, `I'm ${next}`),
        el("button", { onclick: () => set({ handoff: null }) }, `back to ${s.view.you.player}'s pack`),
      ),
    );
  }

  // Enter continues or sends, Escape backs out of whatever is open (event-screens §4), unless a field has the keyboard.
  function key(e) {
    if (!s.view || e.target.closest?.("input, select, textarea")) return;
    if (s.handoff) return;
    // on a moment's screen: Enter continues, Escape skips to the hub, as its buttons do
    if (s.queue.length && s.at < s.queue.length) {
      if (e.key === "Escape") caughtUp();
      if (e.key === "Enter" && !e.target.closest?.("button"))
        s.at + 1 < s.queue.length ? set({ at: s.at + 1 }) : caughtUp();
      return;
    }
    if (e.key === "Escape") set({ draft: { ...s.draft, picking: null }, tableOpen: false });
    // a focused button answers Enter itself
    if (e.key === "Enter" && !e.target.closest?.("button") && s.view.you && !s.view.released && !s.sending) send();
  }

  function fail(e) {
    mount(
      node,
      el(
        "section",
        { class: "view" },
        el(
          "div",
          { class: "body" },
          el("p", { class: "error", role: "alert" }, e.message),
          el("a", { href: "#/" }, "new game"),
        ),
      ),
    );
  }

  document.addEventListener("keydown", key);
  mount(
    node,
    el("section", { class: "view" }, el("div", { class: "body" }, el("p", { class: "muted" }, "$ git fetch"))),
  );
  fetchView();
  const stop = remote.live(id, () => fetchView());

  return {
    node,
    leave: () => {
      alive = false;
      clearTimeout(auto);
      stop();
      document.removeEventListener("keydown", key);
    },
  };
}

// O-Scoreboard: the totals, and the points each was made of (rules/deck.json scoring).
function scoreboard(view, me, feedback) {
  const rows = [...view.seats].sort((a, b) => view.scores[b].total - view.scores[a].total);
  const parts = (s) =>
    ["lines", "fixes", "blame", "sins", "grudges", "merge"]
      .filter((k) => s[k])
      .map((k) => `${k} ${s[k] > 0 ? "+" : ""}${s[k]}`);

  return el(
    "section",
    { class: "view scoreboard" },
    el(
      "div",
      { class: "body" },
      el("h1", {}, "v1.0 shipped"),
      el(
        "p",
        { class: view.released.production_down ? "error" : "muted" },
        view.released.production_down ? "Production is down." : `${view.released.bugs} bugs reached production.`,
      ),
      el("p", { class: "verdict" }, whatDecidedIt(view.scores)),
      el(
        "ol",
        { class: "seats" },
        rows.map((id) =>
          el(
            "li",
            { class: `seat${id === view.you?.player ? " you" : ""}` },
            el("span", { class: "who" }, id),
            el("span", { class: "score" }, view.scores[id].total),
            el("span", { class: "facts" }, parts(view.scores[id]).join(" · ")),
          ),
        ),
      ),
      feedback,
      me && nudge(me),
    ),
    el(
      "div",
      { class: "actions" },
      el("a", { class: "button", href: `#/r/${view.id}` }, "replay it"),
      el("a", { class: "button primary", href: "#/" }, "new game"),
    ),
  );
}
