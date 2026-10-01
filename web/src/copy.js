// Every coach line, keyed by moment (event-screens §6): second person, one sentence of what happened and one of what
// to do next, no exclamation marks. Git's own words are in a moment's output, never here; this is the teacher's voice
// beside the terminal. It is the one file a translation would replace.

const yours = {
  pushed: () => "Your commit is on main, face-down. Nobody knows yet whether it holds a bug.",
  pulled: (m) =>
    m.events.at(-1).merge_token
      ? "You merged into your unpushed work, so you took a merge token. A --rebase costs 2 ops and takes none."
      : "Your pointer is at the tip. A push now would be accepted, unless someone pushes first.",
  conflict: (m) =>
    ({
      theirs:
        "A commit that came in touched a file yours did, and keeping theirs dropped yours: nobody is there to ask in the middle of the night. Choose the strategy on the pull.",
      ours: "A commit that came in touched a file yours did, and keeping yours crossed theirs out on main: you hold a grudge for it.",
      resolve: "A commit that came in touched a file yours did, and you kept both by hand, for an extra op.",
    })[m.events.find((x) => x.type === "conflict_resolved")?.strategy] ?? "",
  rejected: (m) =>
    m.output[0].startsWith("CI failed")
      ? "Flaky CI rejected your push; the op is spent. Tomorrow's first push rolls again only if the incident repeats."
      : "Someone pushed before you, so main moved on. Put a pull before your push: it's free when nothing moved.",
  blamed: (m) =>
    m.tone === "reject"
      ? "You found a bug: its author takes -3 now. The commit stays face-up."
      : "Clean. An op and a card for nothing; a bluff is only a bluff if someone calls it.",
  reverted: () => "The bug no longer counts, and you get +1 for the fix.",
  forced: () =>
    "You overwrote main: the erased commits went back to their owners, and you took a sin. Anyone holding a reflog can undo it.",
  reflog: () => "Your trap fired: the commits a force-push erased are back on top of main, for free.",
  tagged: () => "You tagged v1.0. CI now flips every commit on main.",
  failed: () => "That op failed and its cost is spent. The rest of your pack still ran.",
  skipped: () => "Your budget ran out before this op. A pull or push that turns out free leaves room for more.",
  empty: () => "No pack arrived, so the day ran without you. Two in a row and you leave the company.",
  left: () => "You left the company. Your commits stay on main, and still take the blame.",
  staged: () => "Staged. Commit them into one card on your local branch, then push.",
  committed: () => "Committed locally. Nobody sees it until you push.",
};

const theirs = {
  pushed: (m) => `${m.player} pushed, so the tip moved. Unless you pull first, your next push is rejected.`,
  pulled: (m) => `${m.player} pulled to the tip.`,
  conflict: (m) => `${m.player} hit a conflict and settled it with the strategy they declared.`,
  rejected: (m) => `${m.player}'s push was rejected.`,
  blamed: (m) =>
    m.events.at(-1).author === m.you
      ? m.tone === "reject"
        ? `${m.player} called your bluff: -3 for you.`
        : `${m.player} blamed your commit and found it clean. They spent an op and a card on it.`
      : m.tone === "reject"
        ? `${m.player} found a bug in ${m.events.at(-1).author}'s commit.`
        : `${m.player} blamed a clean commit.`,
  reverted: (m) => `${m.player} reverted their own bug: it no longer counts.`,
  forced: (m) =>
    `${m.player} force-pushed over main. Erased commits went back to their owners' branches, to push again.`,
  reflog: (m) => `${m.player}'s reflog fired: what the force-push erased is back.`,
  tagged: (m) => `${m.player} tagged v1.0. CI now flips every commit on main.`,
  empty: (m) => `${m.player} sent no pack today.`,
  left: (m) => `${m.player} left the company. Their commits stay on main and still take the blame.`,
};

const table = {
  incident: () => "A new day. Write your pack: up to 4 ops, within today's budget.",
  ci: (m) =>
    m.ci.production_down
      ? `${m.ci.bugs} bugs reached production: production is down.`
      : m.ci.bugs
        ? `${m.ci.bugs} bug${m.ci.bugs === 1 ? "" : "s"} reached production; each unblamed one costs its author.`
        : "Every commit is clean. Ship it.",
};

/** The day's opener, under the incident and what you drew: where you stand, and what that means for your pack. */
export const OPENER = {
  drew: (n) => `You drew ${n === 2 ? "two cards" : n === 1 ? "a card" : `${n} cards`}.`,
  atTip: "You are at the tip: a push would land, unless someone else's lands first.",
  behind: (n) =>
    `You are ${n} behind: a push would be rejected. The pull your pack writes before it costs an op today.`,
};

/** The coach line for moment `m` as `you` reads it, or null for a moment that needs none. */
export function coach(m, you) {
  const line = table[m.kind] ?? (m.player === you ? yours[m.kind] : theirs[m.kind]);
  return line ? line({ ...m, you }) : null;
}
