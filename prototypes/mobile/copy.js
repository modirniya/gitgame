// Every string the player reads, keyed by event or reason, in one place (spec §6). Rules for copy: Git's exact
// messages where Git has one; second person; one sentence of what happened, one of what to do next; no exclamation
// marks except in incident names. The first draft of all of it is play-vs-bot's coach panel.

const s = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
export const plural = s;
const c = t => `<code>${t}</code>`; // copy is trusted text; ids and messages are escaped by the screens that pass them

export const BRAND = { name: 'Git Game', tagline: 'a card game about Git' }; // BRAND — the name is not final (docs/branding.md)

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

// Git's own output, verbatim where Git has a message for what happened.
export const GIT = {
  commit: (sha, msg, files, n) => `[main ${sha}] ${msg}\n ${s(files, 'file')} changed, ${s(n, 'insertion')}(+)`,
  push: (from, to) => `To origin\n   ${from}..${to}  main -> main`,
  rejected: `To origin\n ! [rejected]        main -> main (non-fast-forward)\nerror: failed to push some refs to 'origin'\nhint: Updates were rejected because the tip of your current branch is behind\nhint: its remote counterpart. If you want to integrate the remote changes,\nhint: use 'git pull' before pushing again.`,
  merge: "Merge made by the 'ort' strategy.",
  fastForward: (from, to) => `Updating ${from}..${to}\nFast-forward`,
  rebase: 'Successfully rebased and updated refs/heads/main.',
  conflict: file => `CONFLICT (content): Merge conflict in ${file}\nAutomatic merge failed; fix conflicts and then commit the result.`,
  forced: (from, to) => `To origin\n + ${from}...${to} main -> main (forced update)`,
  revert: (sha, msg) => `[main ${sha}] ${msg}`,
  tag: 'git tag -a v1.0 -m "v1.0"',
};

// Every screen's words. Keys are screen ids; functions take the event or the facts the screen has.
export const SCREEN = {
  start: {
    pitch: 'Two developers, one main. Push first, pull when you are behind, and hope nobody runs git blame on your bugs.',
    guided: 'Guided first game', guidedNote: 'Highlights the one thing to tap, for two turns.',
    go: 'New game', seed: n => `seed ${n}`,
  },
  incident: { title: n => `Round ${n} of 12`, got: 'Got it' },
  yourTurn: {
    title: ops => `Your turn · ${s(ops, 'op')}`,
    drew: 'You drew two cards.',
    atTip: 'You are at the tip: a push would be accepted.',
    behind: n => `You are ${n} behind: a push would be rejected. Pull first.`,
    play: 'Play',
  },
  hub: {
    hand: 'your hand', mat: 'staged', local: 'to push', empty: 'empty',
    hint: 'hint', undo: 'undo', end: 'end turn', undone: 'Back to before your last op. Nothing the bot did can be undone.',
    commandOnly: n => ({ reflog: 'reflog is a trap: it fires by itself, free, the moment the bot force-pushes your commits away.' })[n] || '',
    op: { stage: 'git add', commit: 'git commit', push: 'git push', pull: 'git pull', blame: 'git blame', revert: 'git revert', force: 'git push --force', tag: 'git tag v1.0' },
    ok: {
      stage: (cards, lines) => cards ? `Put ${s(cards, 'card')} (+${lines}) on your mat.` : 'Tap cards in your hand first.',
      commit: d => `Turn the mat into one commit worth ${d.lines} lines.`,
      push: d => d.behind ? `Will be REJECTED: you are ${d.behind} behind. Pull first.` : `Puts ${s(d.commits.length, 'commit')} on main.${d.flaky ? ' Flaky CI: this push rolls the die.' : ''}`,
      pull: d => `Catch up ${s(d.behind, 'commit')}.${d.conflict ? ' CONFLICT ahead.' : ''}`,
      blame: () => 'Flip one face-down commit on main. A bug costs its author −3.',
      revert: () => 'Neutralise a flipped bug on main: +1 for you.',
      force: d => `Rewind main to your pointer, erasing ${s(d.behind, 'commit')}. +1 sin.`,
      tag: () => 'End the game now. CI flips every card.',
      endTurn: d => `Give up your ${s(d.ops, 'op')} left.`,
    },
    no: {
      'no-ops': 'No ops left this turn.', 'no-commit-cards': 'No commit cards in your hand.', 'mat-empty': 'Nothing on your mat yet.',
      'nothing-to-push': 'Nothing to push. Commit first.', 'up-to-date': 'Already up to date.', 'no-card': 'You don’t hold that card.',
      sodown: 'Stack Overflow is down: no command cards this round.', 'no-face-down': 'Every commit on main is already face-up.',
      'no-flipped-bug': 'No flipped bug on main to revert.', behind: 'A revert is a commit you push: pull first.',
      'nothing-ahead': 'Nothing is ahead of you to erase.', 'too-early': 'main needs 10 commits.',
    },
  },
  stage: {
    title: 'git add', add: n => `Add ${s(n, 'card')} · 1 op`, cancel: 'Cancel',
    forms: (lines, withMat) => withMat ? `With what is already staged, your next commit is worth ${lines} lines.` : `These become one commit worth ${lines} lines.`,
    bug: 'Contains a bug. Nobody knows that but you, until someone flips it.',
    big: 'One big commit scores more at once, but one bug inside and git blame penalises all of it.',
  },
  staged: { title: 'git add', said: n => `${s(n, 'card')} on your mat. Not a commit yet.` },
  commit: {
    title: 'git commit', label: 'Commit message', commit: 'Commit · 1 op', cancel: 'Cancel',
    rule: 'Commit messages are read by git log a year from now. "fix", "wip" or "asdf" draws a bug.',
    lazyWarn: 'That message draws a bug.',
  },
  committed: {
    said: (sha, lines) => `${c(sha)} is on your local branch, worth ${lines} lines once it reaches main.`,
    bug: ' It contains a bug. Nobody knows that but you, until someone flips it.',
    lazy: ' The lazy message drew a bug into it.',
    behind: n => `You are ${n} behind the tip, so a push would be rejected. Pull first.`,
    atTip: 'You are at the tip: push now, before the bot moves it.',
  },
  pushed: {
    said: ids => `Pushed. ${ids.map(c).join(', ')} ${ids.length > 1 ? 'are' : 'is'} face-down at the end of main: everyone sees the file and the lines, nobody sees whether it is a bug.`,
    then: 'The bot is now behind you and must pull before it can push.',
    die: n => `Flaky CI: you rolled a ${n}. Green.`,
    tagAhead: 'main has reached the release size and you are ahead. git tag v1.0 ends the game now.',
    tagBehind: 'main has reached the release size, but you are behind on points. The bot will tag it the moment it is ahead.',
  },
  rejected: {
    said: 'Rejected, op spent. The bot pushed since your pointer last moved, so main has history you haven’t seen, and Git won’t push over it.',
    then: 'This is the whole game. Pull to catch up (1 op, merge token) or pull --rebase (2 ops, clean), then push.',
    flakyBanner: n => `CI: build failed. You rolled a ${n}.`,
    flaky: n => `CI was flaky and you rolled a ${n}. Push rejected, op spent, nothing you could have done.`,
    flakyThen: 'The die is rolled only once per round, so the next push is safe from it.',
  },
  pull: {
    title: 'git pull', said: (n, ids) => `You are ${n} behind: ${ids.map(c).join(', ')} ${ids.length > 1 ? 'are' : 'is'} on main and not on your branch.`,
    plain: 'git pull', plainWhy: '1 op · takes a merge token (−1 at the end)',
    rebase: 'git pull --rebase', rebaseWhy: '2 ops · clean history, no token',
    conflict: file => `CONFLICT ahead on ${file}: you will pick a strategy.`, cancel: 'Cancel',
  },
  conflict: {
    said: (mine, theirs) => `Your ${c(mine)} and the bot's ${c(theirs)} both change this file. Git can't merge them for you. Pick one.`,
    ours: '-X ours', oursWhy: (lines) => `Keep yours. The bot's commit is crossed out: ${lines} lines gone for it, and a grudge against you (−1).`,
    theirs: '-X theirs', theirsWhy: lines => `Drop yours: ${lines} lines discarded. Safe, sad.`,
    resolve: 'resolve by hand', resolveWhy: cost => `Keep both. Costs 1 extra op (${cost} in total).`,
    cantAfford: 'You can’t afford the extra op this turn.',
  },
  resolved: {
    ours: (ids, lines) => `${ids.map(c).join(', ')} crossed out: the bot loses ${lines} lines and holds a grudge against you (−1 for you at the end).`,
    theirs: ids => `${ids.map(c).join(', ')} discarded. Nothing lost but the lines.`,
    resolve: 'Both kept, by hand. It cost an extra op.',
  },
  pulled: {
    said: 'You are up to date.',
    plain: n => `The plain pull cost 1 op and a merge token (−1 at the end); you have ${n}.`,
    rebase: 'The rebase cost 2 ops and left no merge token.',
    push: 'You are at the tip with commits to push: push now.',
    nothing: 'Nothing to push yet. Add and commit.',
  },
  target: {
    blame: 'git blame', blameSaid: 'Tap a face-down commit on main to flip it. A bug costs its author −3; a clean one costs you the card.',
    revert: 'git revert', revertSaid: 'Tap a flipped bug on main to revert it. +1 for you.', cancel: 'Cancel',
  },
  blamed: {
    bug: (sha, who) => `${c(sha)} was a bug. ${who === 'you' ? 'It was yours, so you take −3.' : 'The bot takes −3.'} The card stays face-up.`,
    bugThen: 'A flipped bug can be neutralised with git revert: +1 for whoever fixes it.',
    clean: sha => `${c(sha)} was clean. An op and a card for nothing.`,
    cleanThen: 'Blame the commits that look too good: big line counts from someone in a hurry.',
    stamp: { bug: 'BUG', clean: 'clean' },
  },
  reverted: { said: sha => `${c(sha)} is neutralised and you get +1 for the fix.`, then: 'A revert is a commit on main, so the bot is now behind you.' },
  force: {
    title: 'git push --force', said: n => `This rewrites main. ${s(n, 'commit')} after your pointer will be erased:`,
    sin: 'You take a sin: −1 at the end.', reflog: 'If the bot holds reflog, its commits come straight back on top, and you are the one behind.',
    go: 'Force-push', cancel: 'Cancel',
  },
  forced: {
    you: (erased) => erased.length ? `You rewrote main. ${erased.map(c).join(', ')} erased.` : 'You rewrote main. Nothing was ahead of you, so nothing was erased: a sin for nothing.',
    youThen: 'A sin is −1 at the end. Worth it if you erased more than that.',
    bot: (erased, returned) => `The bot rewrote main. ${erased.length ? erased.map(c).join(', ') + ' erased.' : ''}${returned ? ' Your commits are back on your local branch, and you are behind again.' : ''}`,
    botThen: 'Force-push is the nuke. Keep a reflog in hand when the bot might hold one.',
  },
  reflog: {
    you: ids => `You held reflog: ${ids.map(c).join(', ')} came straight back on top of main. Free, out of turn.`,
    youThen: 'Your commits are at the tip again, and now the bot is behind.',
    bot: ids => `The bot held reflog: ${ids.map(c).join(', ')} came straight back on top of main.`,
    botThen: 'Now you are the one behind.',
  },
  tag: {
    title: 'git tag v1.0', said: n => `main has ${n} commits. Tag v1.0? CI flips every card and the game ends.`,
    ahead: 'If CI ran now, you would be ahead.', behind: 'If CI ran now, you would be behind. Hidden bugs could change that either way.',
    go: 'Tag v1.0', later: 'Not yet',
  },
  summary: { title: 'Your turn, done', none: 'You ended the turn without spending an op.', delta: d => `${d > 0 ? '+' : ''}${d} for you this turn`, watch: 'Watch the bot' },
  botTurn: { title: ops => `Bot's turn · ${s(ops, 'op')}`, behind: n => `It is ${n} behind you.`, atTip: 'It is at the tip.', skip: 'skip bot' },
  botStep: { of: (i, n) => `op ${i} of ${n}`, skip: 'skip bot', end: 'ends its turn' },
  behind: { title: 'The tip moved', said: n => `You are ${n} behind. Pull before you push.`, got: 'Got it' },
  ci: { title: 'CI runs', counting: 'Flipping every card on main…', bugs: n => `${s(n, 'bug')} reached production.`, down: 'Production is down: the release fails and the least blame wins.' },
  score: {
    shipped: 'The release shipped.', down: n => `Production is down (${n} bugs). Least blame wins.`,
    win: { you: 'You win.', bot: 'The bot wins.', draw: 'A draw.' },
    rows: { lines: 'lines on main', fixes: 'fixes', blame: 'blame', merge: 'merge tokens', grudge: 'grudges', sin: 'sins' },
    hands: 'Both hands, revealed', again: 'Play again', replay: 'Replay this seed',
    decided: {
      merge: (a, b) => `merge tokens (${a} vs ${b}), the rebase tax`, blame: (a, b) => `blame (${a} vs ${b}), bugs that got caught`,
      lines: (a, b) => `lines shipped (${a} vs ${b}), who got more pushes through`, sin: 'a force-push', none: 'A close one on every line.',
    },
  },
};

// The receipt on O-TurnSummary: one line per op, as the terminal would have printed the command.
export const RECEIPT = {
  Staged: e => `git add → ${s(e.cards.length, 'card')}`,
  Committed: e => `git commit → ${e.commit}`,
  PushAccepted: e => `git push → ${e.commits.join(', ')} on main`,
  PushRejected: e => e.reason === 'flaky' ? `git push → CI failed (rolled ${e.roll})` : 'git push → ! [rejected]',
  Pulled: e => e.rebase ? 'git pull --rebase → up to date' : 'git pull → up to date, +1 merge token',
  ConflictResolved: e => `  conflict → -X ${e.strategy === 'resolve' ? 'by hand' : e.strategy}`,
  Blamed: e => `git blame ${e.target} → ${e.wasBug ? 'BUG' : 'clean'}`,
  Reverted: e => `git revert ${e.target}`,
  Forced: e => `git push --force → ${s(e.erased.length, 'commit')} erased`,
  ReflogFired: e => `  reflog → ${e.restored.join(', ')} restored`,
};

// What a bot op did, in one line under its bubble (O-BotStep). Only public facts.
export const BOT_DID = {
  Staged: e => `${s(e.cards, 'card')} face-down on its mat.`,
  Committed: () => 'Its mat is now one commit on its local branch, face-down.',
  PushAccepted: e => `${e.roll ? `Flaky CI: it rolled a ${e.roll}, green. ` : ''}${s(e.commits.length, 'commit')} landed on main.`,
  PushRejected: e => e.reason === 'flaky' ? `CI was flaky: it rolled a ${e.roll}. Rejected.` : 'Rejected: it was behind.',
  Pulled: e => e.rebase ? 'Rebased: up to date, no token.' : `Pulled: up to date, merge token ${e.mergeTokens}.`,
  ConflictResolved: e => e.strategy === 'ours' ? `Your ${e.crossedOut.map(c).join(', ')} crossed out: you lose those lines, and it takes a grudge.` : e.strategy === 'theirs' ? 'It dropped its own commit.' : 'It kept both, by hand.',
  Blamed: e => e.author !== 'you' ? `Its own ${c(e.target)}: ${e.wasBug ? 'a bug, −3 for it' : 'clean'}.` : e.wasBug ? `Your ${c(e.target)} was a bug. −3 for you.` : `Your ${c(e.target)} was clean. It wasted a card.`,
  Reverted: e => `${c(e.target)} neutralised: +1 for it.`,
  Tagged: () => 'CI runs now.',
};
export const BOT_TITLE = { push: 'git push', tag: 'git tag v1.0', force: 'git push --force', pull: 'git pull', rebase: 'git pull --rebase', blame: 'git blame', revert: 'git revert', commit: 'git commit', stageTwo: 'git add', stageOne: 'git add', end: 'done' };
