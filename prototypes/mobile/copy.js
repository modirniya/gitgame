// Every string the player reads, keyed by event or reason, in one place (spec §6). Rules for copy: Git's exact
// messages where Git has one; second person; one sentence of what happened, one of what to do next; no exclamation
// marks except in incident names. The first draft of all of it is play-vs-bot's coach panel.

const s = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
export const plural = s;

export const INCIDENT = {
  sodown: { name: 'Stack Overflow Is Down', text: 'No command cards this round.' },
  standup: { name: 'Standup Ran Long', text: 'Everyone has 2 ops this round instead of 3.' },
  flaky: { name: 'Flaky CI', text: 'The first push this round rolls a die. On 1 or 2 it is rejected; the op is spent.' },
  hackathon: { name: 'Hackathon', text: 'Everyone has 4 ops this round.' },
  quiet: { name: 'Quiet Tuesday', text: 'Nothing special. Get some work done.' },
  quiet2: { name: 'Coffee Machine Fixed', text: 'Nothing special. Morale is high.' },
};

// Real-looking Conventional Commits, one list per file, so the log reads like a repository and not like a deck.
const MESSAGES = {
  'auth.js': ['feat(auth): refresh tokens before they expire', 'fix(auth): session fixation on login', 'feat(auth): rate-limit login attempts', 'refactor(auth): hash passwords with argon2', 'fix(auth): handle expired OAuth state'],
  'api.py': ['feat(api): paginate /users', 'fix(api): return 404 for a missing org', 'feat(api): validate request bodies', 'perf(api): cache the leaderboard query', 'fix(api): retry failed webhooks'],
  'styles.css': ['feat(ui): dark mode tokens', 'fix(ui): visible focus ring on buttons', 'fix(ui): tighten mobile gutters', 'style(ui): align the card grid', 'feat(ui): respect reduced motion'],
  Dockerfile: ['build: pin the base image', 'build: multi-stage image', 'build: run as a non-root user', 'build: cache the pip install layer', 'build: add a healthcheck'],
  'README.md': ['docs: local setup', 'docs: contributing section', 'docs: fix the broken badge', 'docs: explain the release process', 'docs: add screenshots'],
};
// Deterministic, so the bot's commits replay identically from a seed.
export function commitMessage(cards) {
  const list = MESSAGES[cards[0].file];
  return list[(cards.reduce((a, c) => a + c.lines, 0) + cards.length) % list.length];
}
export const suggestMessages = cards => cards.length ? [commitMessage(cards), MESSAGES[cards[0].file][(cards[0].lines + 2) % 5]] : [];

// Why a plan was chosen. `bot` is the third-person bubble on O-BotStep (public facts only: see bot.js publicWhy);
// `you` is the hint, which may use everything the player can see.
const conflictBot = c => !c ? '' : {
  resolve: ` Its commit clashed with yours on ${c.file}; it paid an extra op to keep both.`,
  ours: ` Its commit clashed with yours on ${c.file}; it kept its own, crossed yours out and took a grudge.`,
  theirs: ` Its commit clashed with yours on ${c.file}; it dropped its own rather than take a grudge.`,
}[c.strategy];
const conflictYou = c => !c ? '' : {
  resolve: ` Your commit clashes with the bot's on ${c.file}: you can afford the extra op to keep both.`,
  ours: ` Your commit clashes with the bot's on ${c.file}: yours is bigger, keep it and accept the grudge.`,
  theirs: c.ownBug ? ` Your commit clashes with the bot's on ${c.file}: yours is a bug anyway, let it go.` : ` Your commit clashes with the bot's on ${c.file}: theirs is bigger, and dropping yours is cheaper than a grudge.`,
}[c.strategy];

export const REASON = {
  bot: {
    push: w => `It was at the tip with ${s(w.commits.length, 'commit')} ready, so it pushed before you could move the tip.`,
    tag: w => `main has ${w.commits} commits and it leads ${w.mine} to ${w.theirs}, so it tagged v1.0 before you could catch up.`,
    force: w => `Your commits were ${w.behind} ahead of it and it held push --force: one sin to erase them, unless you hold reflog.`,
    pull: w => `It was ${w.behind} behind, so it pulled: 1 op and a merge token.${conflictBot(w.conflict)}`,
    rebase: w => `It was ${w.behind} behind and already holds ${s(w.merge, 'merge token')}, so it paid 2 ops to rebase cleanly.${conflictBot(w.conflict)}`,
    blame: w => `Your ${w.target} is ${w.targetLines} lines and still face-down, and big commits are where bugs hide.`,
    revert: w => `Its own ${w.target} was a flipped bug and it was at the tip, so it reverted it for +1.`,
    commit: () => 'It committed what was on its mat, so it can push next.',
    stageTwo: () => 'It staged two cards for one bigger commit: it can afford to commit and push this turn.',
    stageOne: () => 'It staged a card.',
    end: w => `It had ${s(w.ops, 'op')} left and nothing worth spending ${w.ops === 1 ? 'it' : 'them'} on.`,
  },
  you: {
    push: w => `You are at the tip with ${w.commits.join(', ')} ready. Push before the bot moves the tip.`,
    tag: w => `main has ${w.commits} commits and you are ${w.mine > w.theirs ? 'ahead' : 'level'}, ${w.mine} to ${w.theirs}. End it now, before the bot gets ahead.`,
    force: w => `${w.behind} of the bot's commits are ahead of you and you hold push --force. Erasing them costs one sin and a lot of its points, unless it holds reflog.`,
    pull: w => `You are ${w.behind} behind, so nothing can be pushed until you catch up. A plain pull is 1 op and a merge token.${conflictYou(w.conflict)}`,
    rebase: w => `You are ${w.behind} behind. Rebase: 2 ops, no merge token, and you already have ${w.merge}.${conflictYou(w.conflict)}`,
    blame: w => `${w.target} is ${w.targetLines} lines from the bot and still face-down. Big commits are where bugs hide; a hit is −3 for it.`,
    revert: w => `Your ${w.target} is a flipped bug and you are at the tip. Reverting it earns +1 and stops it counting at the release.`,
    commit: w => `Your mat holds ${w.lines} lines. Commit it so it can be pushed.`,
    stageTwo: w => `Two clean cards and enough ops to commit and push this turn: stage both for one ${w.lines}-line commit.`,
    stageOne: w => `Stage your biggest clean card: ${w.lines} lines.`,
    stageBug: () => 'Only bugs left in hand. Stage the smallest and hope nobody flips it.',
    end: () => 'Nothing useful left to do. End the turn.',
  },
};

export const TABLE = {
  title: 'The table',
  close: 'Close',
  incident: 'incident',
  noTokens: 'no tokens',
  fine: 'Commits on main are face-down: everyone saw the file and the lines when they were pushed, nobody sees whether one is a bug until it is flipped.',
};
