// The guided first game (event-screens §3, "Guided first game"; M14d): a layer over the hub that highlights one thing
// and says one sentence, through a whole day against the bot: pick a card, git add, commit, push (and the pull the
// editor writes first), send; then, the next day, what the day did. A player's first game is guided; the guide can
// be skipped at any step, and is gone for good once the second day has been explained.
import { el } from "./dom.js";

/**
 * The step for `view` and the pack being written: `{target, text}`, where `target` is what to highlight (a card's id,
 * or an action's name), or null once there is nothing more to say. Pure: the same view and draft, the same step.
 */
export function guideStep(view, draft) {
  const you = view.you.player;
  const ops = draft.ops.map((o) => o.op);
  const clean = view.you.hand.find((c) => c.kind === "commit" && !c.bug);

  if (view.day === 1) {
    if (view.sent_today.includes(you))
      return { target: null, text: "Pack sent. The day closes once every pack is in." };
    if (!ops.includes("add")) {
      return draft.selected.length
        ? { target: "add", text: "git add puts it in staging: the next commit is made of what's staged." }
        : {
            target: clean?.id,
            text: "Pick a card from your hand: lines of code, in one file. A clean one is a safe start.",
          };
    }
    if (!ops.includes("commit"))
      return { target: "commit", text: "Commit it: one commit on your own branch. Nobody else sees it yet." };
    if (!ops.includes("push"))
      return {
        target: "push",
        text: "Push it to main. If the bot pushes first, your push is rejected; watch what gets written first.",
      };
    return {
      target: "send",
      text: "A pull went in before the push: it catches you up if main moved, and it's free if nothing did. Send your pack.",
    };
  }

  if (view.day === 2)
    return {
      target: null,
      text: "Commits on main are face-down: nobody knows which hold bugs until blame or CI. Ship the most clean lines by the release. You're on your own now.",
    };

  return null;
}

/** The guide over the hub: its sentence, and "skip" or "got it". */
export function guideLayer(step, { done }) {
  return el(
    "aside",
    { class: "guide", role: "status" },
    el("p", {}, step.text),
    el("button", { class: "link", onclick: done }, step.target ? "skip the guide" : "got it"),
  );
}

/** Highlights the step's target inside `node`: a card by its id, or an action by its name. */
export function highlight(node, target) {
  if (!target) return;
  node.querySelector(`[data-guide="${target}"], .hub [data-id="${target}"]`)?.classList.add("guide-target");
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
