// The bot as a character (event-screens §5, M15g): an avatar, its ops counted, and a speech bubble saying why it
// played each op and how that went. The bot writes its pack when the day opens, so its own `why` can't know what the
// day did to it ("it ships what it has committed", before a push that found nothing to ship); the bubble is written
// here from the why's intent and the step's outcome, from public facts only, as the bot's why is.
import { el } from "./dom.js";

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
// "your 53d8cce" and "as yours did", or someone else's by name either way
const whose = (author, you) => (author === you ? "your" : `${author}'s`);
const theirs = (author, you) => (author === you ? "yours" : `${author}'s`);
const capital = (text) => text[0].toUpperCase() + text.slice(1);

/** What the bot says about step `s` (from playback.js), as `you` reads it; null to say nothing. */
export function says(s, { you }) {
  const m = s.moment;
  const e = m.events.at(-1);
  const resolved = m.events.find((x) => x.type === "conflict_resolved");
  const clash = m.events.find((x) => x.type === "conflict_detected")?.conflicts?.[0];
  const commit = (id) => s.before?.main.find((c) => c.id === id);

  switch (m.kind) {
    case "committed": {
      const staged = s.folded.find((x) => x.kind === "staged")?.events[0];
      const cards = staged?.count ?? staged?.cards?.length;
      return cards
        ? `It built a commit of ${plural(cards, "card")}: face-down on its branch, where nobody can see it until it pushes.`
        : "It committed what it had staged: face-down on its branch, until it pushes.";
    }
    case "pushed":
      return `It had ${plural(e.commits.length, "commit")} ready, so it shipped: the tip is its now.`;
    case "push_noop":
      return "It meant to ship its commit, but the pull before the push dropped it: nothing was left to push.";
    case "pulled":
      return e.merge_token
        ? "Main had moved, so it caught up: 1 op, and a merge token for merging its own commit in."
        : "Main had moved, so it caught up: a fast-forward, with nothing of its own to merge.";
    case "conflict": {
      const file = clash?.files.join(", ") ?? "the same file";
      if (resolved?.strategy === "ours")
        return `Its commit touched ${file}, as ${theirs(commit(clash?.theirs)?.author, you)} did. It kept its own and crossed the other out: a grudge for it.`;
      if (resolved?.strategy === "resolve")
        return `Its commit touched ${file}, as another did. It paid an extra op to keep both, by hand.`;
      return `Its commit touched ${file}, as ${theirs(commit(clash?.theirs)?.author, you)} did, and keeping theirs dropped its own.`;
    }
    case "rejected":
      return m.output[0]?.startsWith("CI failed")
        ? `Flaky CI ${m.output[0].match(/rolled \d+/)?.[0] ?? "rolled low"}: its push was rejected, and the op is spent.`
        : "Main had moved since it last pulled, so Git refused its push. The op is spent.";
    case "blamed": {
      const c = commit(e.target);
      const big = c?.lines
        ? `${capital(whose(e.author, you))} ${e.target} is ${c.lines} lines and was face-down: big commits are where bugs hide.`
        : null;
      return [
        big,
        e.bug
          ? `It was a bug: −3 to ${e.author === you ? "you" : e.author}.`
          : "It was clean: an op and a card spent for nothing.",
      ]
        .filter(Boolean)
        .join(" ");
    }
    case "reverted":
      return "Its own bug was face-up on main, so it reverted it: the bug no longer counts, and +1 for the fix.";
    case "forced":
      return `${plural(e.erased.length, "commit")} of others sat ahead of its pointer, and it held push --force: it overwrote main, for a sin.`;
    case "tagged":
      return "Main is the size of a release and it isn't behind on points, so it tagged v1.0: CI runs now.";
    default:
      return m.why;
  }
}

/** The bot's side of a step: its avatar, and its ops as dots, the ones played so far filled. */
export function botHead(s) {
  const { at, of } = s.of ?? { at: 1, of: 1 };
  return el(
    "div",
    { class: "bot-head" },
    el("span", { class: "avatar", "aria-hidden": "true" }, s.moment.player),
    el(
      "span",
      { class: "dots", role: "img", "aria-label": `op ${at} of ${of}` },
      Array.from({ length: of }, (_, i) => el("i", { class: i < at ? "on" : "" })),
      el("span", {}, `op ${at} of ${of}`),
    ),
  );
}
