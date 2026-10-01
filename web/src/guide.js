// The guided first game (event-screens §3, "Guided first game"; M14d, M15h): a layer at the top of the screen that
// highlights one thing and says one sentence, through the first days against the bot, as the prototype's did: build
// a commit and push it, watch the day close, build another, and catch up when the bot's push lands first. The remote
// deals a guided game so that the first push lands (M15h); what happens after that is the game's. It counts its
// steps, can be skipped at any one, and is gone for good once done.
import { el } from "./dom.js";
import { price } from "./pack.js";

// The steps in order, for "guide · n of N"; the day-2 lesson is one or the other, whichever the day taught.
const STEPS = ["pick", "add", "commit", "push", "send", "landed", "closed", "again", "lesson", "done"];
const at = (id, text, target = null) => ({ id, n: STEPS.indexOf(id) + 1, of: STEPS.length, text, target });

// Building a commit and sending it, the same on any day: a card, git add, commit, push, send.
function build(view, draft, first) {
  const ops = draft.ops.map((o) => o.op);
  const clean = view.you.hand.find((c) => c.kind === "commit" && !c.bug);
  if (!ops.includes("add"))
    return draft.selected.length
      ? at("add", "Tap git add: the card goes onto your staging mat. One op.", "add")
      : first
        ? at(
            "pick",
            "Pick a card from your hand: lines of code, in one file. One without a BUG tag is a safe start.",
            clean?.id,
          )
        : null;
  if (!ops.includes("commit"))
    return at(
      "commit",
      "Tap git commit: what is staged becomes one commit on your branch. Nobody else sees it yet.",
      "commit",
    );
  // a short day (Standup Ran Long: 2 ops) is spent by add and commit, and a push past the budget doesn't run
  const { rows, spent } = price(view, draft.ops);
  const push = rows.find((r) => r.op.op === "push");
  if (push ? !push.runs : spent + view.costs.ops.push > view.budget)
    return at(
      "send",
      `Only ${view.budget} ops today, and they're spent: your commit waits on your branch, to push another day. Send your pack.`,
      "send",
    );
  if (!push)
    return at(
      "push",
      "Tap git push. Your commit waits past the tip: it lands there if nobody's lands first. A pull goes in before it, free if nothing moved.",
      "push",
    );
  return first
    ? at(
        "send",
        "That's your day: three ops. Send your pack. The bot has sent its own, so the day closes, and you'll watch both play out.",
        "send",
      )
    : at("send", "Send it. Whichever pack the remote runs first, you'll watch it play out.", "send");
}

/** The guide over the hub for `view` and the pack being written, or null once there is nothing more to say. Pure. */
export function guideStep(view, draft) {
  const you = view.you.player;
  const behind = view.players[you].behind;
  if (view.sent_today.includes(you)) return at("send", "Pack sent. The day closes once every pack is in.");

  if (view.day === 1) return build(view, draft, true);
  if (view.day === 2) {
    if (behind && !draft.ops.length && !draft.selected.length)
      return at(
        "lesson",
        `The tip moved: you're ${behind} behind. Your pack writes a pull before its push: it catches you up, for an op. Pick a card to start.`,
        view.you.hand.find((c) => c.kind === "commit" && !c.bug && !draft.selected.includes(c.id))?.id,
      );
    // building again is one step of the guide's, however many taps it takes
    const next = build(view, draft, false);
    if (next) return { ...next, n: STEPS.indexOf("again") + 1 };
    return at(
      "again",
      "Day 2: the bot has a commit waiting to push. Build yours as yesterday: if the bot's pack runs first, its push lands, and the pull before yours catches you up.",
      view.you.hand.find((c) => c.kind === "commit" && !c.bug)?.id,
    );
  }
  if (view.day === 3)
    return at(
      "done",
      "You know the loop: pull if behind, add, commit, push. Hint shows what a good player would do; the table shows everything on it. From here it's your game.",
    );
  return null;
}

/** The guide on a step of a day played back (playback.js), as `you` reads it, or null. Pure. */
export function guideOnStep(step, you) {
  const m = step.moment;
  if (step.day === 1 && m?.kind === "pushed" && m.player === you)
    return at(
      "landed",
      "Your push landed: the remote ran your pack first today. Your commit is on main, face-down. Now watch the bot.",
    );
  if (step.day === 1 && step.kind === "summary")
    return at(
      "closed",
      "That's a day: every pack ran, in an order the remote drew. Nobody knows yet which commits on main hold bugs, until blame or CI flips them.",
    );
  if (step.day === 2 && step.kind === "summary") {
    if (step.behind)
      return at(
        "lesson",
        "The bot's push landed last, so you're behind now. Tomorrow your pack's pull catches you up, before its push.",
      );
    return step.order[0] === you
      ? at(
          "lesson",
          "Your pack ran first and your push landed. Some days the remote draws the other order, and the bot's lands first.",
        )
      : at(
          "lesson",
          "The bot's pack ran first and its push landed, so the pull before yours caught you up, and your push landed after it. That's what the pull is for.",
        );
  }
  return null;
}

/** The guide's layer: where it is in its steps, its sentence, and "skip" or "got it". */
export function guideLayer(step, { done }) {
  return el(
    "aside",
    { class: "guide", role: "status" },
    el("span", { class: "guide-step" }, `guide · ${step.n} of ${step.of}`),
    el("p", {}, step.text),
    el("button", { class: "link", onclick: done }, step.id === "done" ? "got it" : "skip the guide"),
  );
}

/** Highlights the step's target inside `node`: a card by its id, or an action by its name. */
export function highlight(node, target) {
  if (!target) return;
  const t = node.querySelector(`[data-guide="${target}"], .hub [data-id="${target}"]`);
  t?.classList.add("guide-target");
  // the one thing to tap must be on screen: a card can sit below the fold of the pack
  t?.scrollIntoView?.({ block: "nearest" });
}

// Whether a game is guided is this device's to remember (localStorage): "on" until the guide is done or skipped.
const key = (id) => `gitgame:guided:${id}`;

export function isGuided(id) {
  try {
    return localStorage.getItem(key(id)) === "on";
  } catch {
    return false;
  }
}

export function setGuided(id, on) {
  try {
    localStorage.setItem(key(id), on ? "on" : "done");
  } catch {
    // storage off: the game simply isn't guided
  }
}
