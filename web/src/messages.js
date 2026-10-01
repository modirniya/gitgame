// Commit messages to offer for what is staged, so a commit reads like a real repository's log (the prototype offered
// them as one-tap suggestions) and nobody writes `git commit -m ""` by tapping past an empty field.

const BY_FILE = {
  "auth.js": [
    "feat(auth): refresh tokens before they expire",
    "fix(auth): session fixation on login",
    "feat(auth): rate-limit login attempts",
    "refactor(auth): hash passwords with argon2",
  ],
  "api.py": [
    "feat(api): paginate /users",
    "fix(api): return 404 for a missing org",
    "perf(api): cache the leaderboard query",
    "fix(api): retry failed webhooks",
  ],
  "styles.css": [
    "feat(ui): dark mode tokens",
    "fix(ui): visible focus ring on buttons",
    "style(ui): align the card grid",
    "fix(ui): tighten mobile gutters",
  ],
  Dockerfile: [
    "build: pin the base image",
    "build: multi-stage image",
    "build: run as a non-root user",
    "build: add a healthcheck",
  ],
  "README.md": [
    "docs: local setup",
    "docs: explain the release process",
    "docs: fix the broken badge",
    "docs: contributing section",
  ],
};

/** Up to three messages for a commit of `cards`, the first the one to start with. Same cards, same messages. */
export function suggestions(cards) {
  const files = [...new Set(cards.map((c) => c.file))].filter((f) => BY_FILE[f]);
  if (!files.length) return ["chore: small changes"];
  const lines = cards.reduce((n, c) => n + c.lines, 0);
  const list = BY_FILE[files[0]];
  const own = [0, 1].map((k) => list[(lines + k) % list.length]);
  const other = files[1] && BY_FILE[files[1]][lines % BY_FILE[files[1]].length];
  return [...new Set([...own, other ?? list[(lines + 2) % list.length]])];
}
