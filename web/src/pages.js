// The pages beside the landing page and the game (docs/design/website-content.md): the door at /git and, under it,
// one page per line Git prints in the game. One list, so the build's inputs, the sitemap and the door agree; the
// test beside this file holds them to it. A page lives at web/<path>/index.html and is served at /<path>.
export const pages = [
  { path: "git", title: "What Git said" },
  { path: "git/non-fast-forward", title: "Rejected: non-fast-forward" },
];
