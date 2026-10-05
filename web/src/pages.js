// The pages beside the landing page and the game (docs/design/website-content.md): the doors at /git and /teach and,
// under /git, one page per line Git prints in the game and one per predicament it puts you in. One list, so the
// build's inputs, the sitemap, the door and the landing page's header agree; the test beside this file holds them to
// it. A page lives at web/<path>/index.html and is served at /<path>.
export const pages = [
  { path: "git", title: "What Git said" },
  { path: "git/non-fast-forward", title: "Rejected: non-fast-forward" },
  { path: "git/forced-update", title: "Forced update" },
  { path: "git/conflict", title: "Merge conflict" },
  { path: "git/already-up-to-date", title: "Nothing to do, two spellings" },
  { path: "git/fast-forward", title: "Fast-forward and rebased" },
  { path: "git/force-pushed-over-me", title: "Someone force-pushed over my commit" },
  { path: "git/push-rejected", title: "My push was rejected" },
  { path: "git/lost-commit", title: "I lost a commit" },
  { path: "git/who-broke-main", title: "Who broke main" },
  { path: "git/undo-on-main", title: "Undo a commit that's on main" },
  { path: "teach", title: "Teach Git with a game" },
];
