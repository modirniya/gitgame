// The pages beside the landing page and the game (docs/design/website-content.md): the door at /git and, under it,
// one page per line Git prints in the game. One list, so the build's inputs, the sitemap and the door agree; the
// test beside this file holds them to it. A page lives at web/<path>/index.html and is served at /<path>.
export const pages = [
  { path: "git", title: "What Git said" },
  { path: "git/non-fast-forward", title: "Rejected: non-fast-forward" },
  { path: "git/forced-update", title: "Forced update" },
  { path: "git/conflict", title: "Merge conflict" },
  { path: "git/already-up-to-date", title: "Nothing to do, two spellings" },
  { path: "git/fast-forward", title: "Fast-forward and rebased" },
];
