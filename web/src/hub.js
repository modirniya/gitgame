// I-Hub (event-screens §3): where a day's pack is written, laid out as the prototype's table. `main` at the top with
// what your pack pushes waiting at its end, your branch as the pack would leave it, your hand, and at the thumb the
// four big actions, each saying what it would do now or why it can't, with a command card's action once you pick one.
// The hub holds nothing: it renders a view and a draft (`{ops, selected, picking}`) and hands every change to `change`.
import { el } from "./dom.js";
import { card } from "./cards.js";
import { strip } from "./table.js";
import { actions, add, consequences, price, unspent } from "./pack.js";
import { suggestions } from "./messages.js";
import { branch, own } from "./branch.js";
import { command, packList } from "./packlist.js";
import { incidentText } from "./copy.js";

// A hand card is 96 px wide; a fanned one shows at least this much of itself, a finger's width.
const CARD = 96;
const TAP = 44;
// A card's longest label (`git bisect`), centred, is clear of the next card while the card shows this much of itself;
// fanned closer, each card is printed like a playing card's corner instead.
const LABEL = 88;
// A card in the phone's grid is at least this wide, so the deck's longest file name fits on one line.
const CELL = 76;
const GAP = 8;

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

/** How the hand lies in a grid `width` wide: as many columns as keep each card CELL wide, and each card's width. */
export function gridLayout(width) {
  const cols = Math.max(1, Math.floor((width + GAP) / (CELL + GAP)));
  return { cols, cell: Math.floor((width - (cols - 1) * GAP) / cols) };
}

// A laptop's layout, the Table beside the hub (frame.css).
const wide = () => (globalThis.innerWidth || 390) >= 1000 && (globalThis.innerHeight || 844) >= 560;

// The hub's width: the phone's, or on a wide screen the column beside the Table, less its gutters.
function column() {
  const w = globalThis.innerWidth || 390;
  return (wide() ? Math.min(560, Math.max(460, w * 0.38)) : Math.min(w, 520)) - 32;
}

// On a laptop the hand fans, as the prototype's did; on a phone, where a fan would hide most of each card, it lies in
// a grid with nothing overlapping.
function hand(cards) {
  const width = column();
  if (!wide()) {
    const { cols, cell } = gridLayout(width);
    return el(
      "div",
      { class: "hand-rows hand-grid", "aria-label": "your hand", style: `--cols: ${cols}; --cell: ${cell}px` },
      cards,
    );
  }
  const { perRow, overlap } = fanLayout(cards.length, width);
  const rows = [];
  for (let i = 0; i < cards.length; i += perRow) rows.push(cards.slice(i, i + perRow));
  const kind = CARD - overlap < LABEL ? "hand-fan fanned" : "hand-fan";
  return el(
    "div",
    { class: "hand-rows", "aria-label": "your hand" },
    rows.map((row) => el("div", { class: kind, style: `--overlap: ${overlap}px` }, row)),
  );
}

// short names, as the warning about unspent ops lists them
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
// as the buttons name them: the command
const NAMES = {
  add: "git add",
  commit: "git commit",
  pull: "git pull",
  push: "git push",
  blame: "git blame",
  revert: "git revert",
  force: "git push --force",
  arm: "arm reflog",
  tag: "git tag v1.0",
};
// the action a command card in your hand plays
const PLAYS = { blame: "blame", revert: "revert", force: "force", reflog: "arm" };

function receipt(view, r) {
  const cost = r.cost === r.most ? ops(r.cost) : `${r.cost}–${r.most} ops`;
  return el(
    "p",
    { class: `receipt${r.runs ? "" : " over"}`, "aria-live": "polite" },
    el("span", { class: "cmd" }, command(r.op, view)),
    ` · ${cost}`,
    (r.note || !r.runs) && ` · ${r.runs ? r.note : "not run: over budget"}`,
  );
}

const ops = (n) => (n === 0 ? "free" : `${n} op${n === 1 ? "" : "s"}`);

// What a good player would write today (M15k): the pack the bot's own policy writes from your seat, its first reason,
// and an offer to write it into your pack.
function hintLine(view, hint, use) {
  return el(
    "div",
    { class: "hintline", role: "status" },
    el("span", { class: "k" }, "hint"),
    el("span", { class: "cmds" }, hint.ops.map((op) => command(op, view)).join(" · ")),
    hint.ops[0]?.why && el("span", { class: "why" }, hint.ops.find((op) => op.op !== "pull")?.why ?? hint.ops[0].why),
    el("button", { class: "use", onclick: use }, "write it into my pack"),
  );
}

/**
 * `warned`: the send button was tapped with ops left unspent, so the hub says what could still be done. `extra` is
 * anything the game adds under the pack (the "remind me" button). `hint` is what a good player would write, once asked
 * for with `onHint`.
 */
export function hub({
  view,
  draft,
  change,
  send,
  sending = false,
  error = "",
  warned = false,
  extra = null,
  hint = null,
  onHint = null,
}) {
  const priced = price(view, draft.ops);
  const left = priced.left;
  const unused = warned && unspent(view, draft.ops);
  const inHand = new Set(left.hand.map((c) => c.id));
  const selected = draft.selected.filter((id) => inHand.has(id));
  const can = actions(view, draft.ops, selected);
  const will = consequences(view, draft.ops, selected);
  const put = (op) => change({ ...draft, ops: add(view, draft.ops, op), selected: [], picking: null });
  const sent = view.sent_today.includes(view.you.player);
  const picked = left.hand.find((c) => c.kind === "command" && selected.includes(c.id));

  // what an action costs as the pack stands: the op's own cost, now and at most
  const cost = (key) => {
    if (key === "add") return ops(view.costs.ops.add);
    if (key === "blame" || key === "revert") return ops(view.costs.commands[key]);
    if (draft.ops.length >= view.max_ops) return "";
    const r = price(view, add(view, draft.ops, OPS[key]())).rows.at(-1);
    return r.cost === r.most ? ops(r.cost) : `${r.cost}–${r.most} ops`;
  };
  const OPS = {
    add: () => ({ op: "add", cards: selected }),
    commit: () => ({ op: "commit", message: suggestions(left.staged)[0] }),
    pull: () => ({ op: "pull" }),
    push: () => ({ op: "push" }),
    force: () => ({ op: "force" }),
    arm: () => ({ op: "arm", trap: "reflog" }),
    tag: () => ({ op: "tag" }),
  };
  const action = (key, wide = false) =>
    el(
      "button",
      {
        class: `op${wide ? " wide" : ""}${!can[key] && key === "push" && left.behind ? " danger" : ""}`,
        "data-guide": key,
        // the button's parts are drawn for the eye; a screen reader gets them as one sentence, as the prototype did
        "aria-label": `${NAMES[key]}, ${cost(key) || "no cost"}: ${can[key] ?? will[key] ?? ""}`,
        disabled: !!can[key],
        onclick: () => (OPS[key] ? put(OPS[key]()) : change({ ...draft, selected: [], picking: key })),
      },
      el("span", { class: "opname" }, NAMES[key]),
      el("span", { class: "cost" }, cost(key)),
      // what it would do, in your situation; or, when it can't be played, why not
      el("span", { class: can[key] ? "why" : "will" }, can[key] ?? will[key] ?? ""),
    );

  // a commit card joins the cards to add; a command card is played alone, so picking one puts the rest down
  const toggle = (c) =>
    change({
      ...draft,
      selected:
        c.kind === "command"
          ? selected.includes(c.id)
            ? []
            : [c.id]
          : selected.includes(c.id)
            ? selected.filter((x) => x !== c.id)
            : [...selected.filter((x) => left.hand.find((h) => h.id === x)?.kind === "commit"), c.id],
    });

  const picking = draft.picking;
  const pickable = (c) =>
    picking === "blame"
      ? !c.initial && !c.revert_of && !c.flipped && c.author !== view.you.player
      : picking === "revert" && c.flipped && c.bug && !c.reverted && !c.overwritten;
  const undo = () => change({ ...draft, ops: draft.ops.slice(0, -1), picking: null });

  return el(
    "section",
    { class: `view hub${picking ? " picking" : ""}`, "aria-label": "write your pack" },
    el(
      "div",
      { class: "body" },
      strip(view, {
        pickable: picking ? pickable : () => false,
        onpick: (c) => put({ op: picking, target: c.id }),
        ghosts: left.pushed.map((c) => own(c, view.you.player)),
        // a pull (or a force-push) in the pack takes your pointer to the tip, as it will if it runs
        pointers: left.behind === 0 ? { [view.you.player]: view.main.length } : {},
      }),
      view.incident &&
        el(
          "p",
          { class: "incident-note" },
          el("span", { class: "k" }, "incident"),
          ` ${view.incident.name} — ${incidentText(view.incident)}`,
        ),
      picking &&
        el(
          "p",
          { class: "picking-line" },
          `git ${picking}: tap a commit on main `,
          el("button", { onclick: () => change({ ...draft, picking: null }) }, "cancel"),
        ),
      branch(view, left, draft.ops),
      hand(left.hand.map((c) => card(c, { selected: selected.includes(c.id), onclick: () => toggle(c) }))),
      packList(view, draft, change, priced),
      unused &&
        el(
          "p",
          { class: "unspent", role: "alert" },
          `# ${unused.left} of today's ${view.budget} ops unspent: you could still ${unused.moves.map((k) => LABELS[k]).join(", ")}`,
        ),
      el("p", { class: "error", role: "alert" }, error),
      extra,
    ),
    el(
      "div",
      { class: "actions hub-actions" },
      hint &&
        hintLine(view, hint, () => change({ ops: hint.ops.map(({ why, ...op }) => op), selected: [], picking: null })),
      // the last op written, answered at the thumb: what it will do, and what the day could still change
      !hint && priced.rows.length > 0 && receipt(view, priced.rows.at(-1)),
      !can.tag && action("tag", true),
      picked && action(PLAYS[picked.command], true),
      el(
        "div",
        { class: "grid4" },
        ["add", "commit", "push", "pull"].map((k) => action(k)),
      ),
      el(
        "div",
        { class: "minor" },
        onHint && el("button", { class: "hint", onclick: onHint }, "hint"),
        el("button", { class: "undo", disabled: !draft.ops.length, onclick: undo }, "undo"),
        el(
          "button",
          { class: "primary send", "data-guide": "send", disabled: sending, onclick: send },
          sending ? "sending…" : unused ? "send anyway" : sent ? "replace today's pack" : "send pack",
        ),
      ),
    ),
  );
}
