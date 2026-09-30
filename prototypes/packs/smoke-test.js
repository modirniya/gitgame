// Smoke test for the pack model: `node smoke-test.js`. Checks the rules of round-resolution.md that the simulation's
// answers depend on, then plays games under every timing and rules variant and checks invariants. Exits non-zero on
// any failure.
import { createGame, startDay, receive, behindBy } from './remote.js';
import { play } from './sim.js';

const failures = [];
const check = (ok, msg) => { if (!ok) { failures.push(msg); console.error('FAIL', msg); } };
// A two-player game on day 1 with a quiet incident and hands we choose.
function table(rules = {}) {
  const s = createGame({ seed: 3, rules }); startDay(s); s.incident = 'quiet';
  const a = s.players.p0, b = s.players.p1;
  a.hand = [{ id: 'a1', file: 'auth.js', lines: 4 }, { id: 'a2', file: 'api.py', lines: 2 }, { id: 'ar', cmd: 'reflog' }];
  b.hand = [{ id: 'b1', file: 'auth.js', lines: 5 }, { id: 'bf', cmd: 'push --force' }];
  return s;
}
const spent = e => e.ops.reduce((n, o) => n + (o.spent || 0), 0);

{ // a pack runs until its 3-op budget is spent; the 4th op only runs if something was free
  const s = table();
  const e = receive(s, 'p0', [{ op: 'add', cards: ['a1'] }, { op: 'commit' }, { op: 'pull' }, { op: 'push' }]);
  check(e.ops[2].noop === 'Already up to date.' && e.ops[2].spent === 0, 'a pull when up to date is free');
  check(e.ops[3].ok && e.ops[3].pushed === 1 && spent(e) === 3, 'add, commit, free pull, push fits a 3-op budget');
  const e2 = receive(s, 'p1', [{ op: 'add', cards: ['b1'] }, { op: 'commit' }, { op: 'pull', strategy: 'ours' }, { op: 'push' }]);
  check(e2.ops[2].spent === 1 && e2.ops[3].skipped === 'budget', 'a pull that catches up costs 1, and then the push no longer fits');
  check(s.players.p0.grudges === 0 && s.players.p1.grudges === 1 && s.main[1].overwritten, '-X ours overwrites their commit and takes a grudge');
}
{ // a stale push is rejected in Git's words and still costs its op — unless the refund variant is on
  for (const refund of [false, true]) {
    const s = table({ refundRejectedPush: refund });
    receive(s, 'p0', [{ op: 'add', cards: ['a1'] }, { op: 'commit' }, { op: 'push' }]);
    const e = receive(s, 'p1', [{ op: 'add', cards: ['b1'] }, { op: 'commit' }, { op: 'push' }]);
    check(e.ops[2].why === '! [rejected] non-fast-forward', 'a push from behind is rejected non-fast-forward');
    check(e.ops[2].spent === (refund ? 0 : 1), `a rejected push costs ${refund ? 0 : 1} with refund ${refund}`);
    check(behindBy(s, 'p1') === 1 && s.players.p1.local.length === 1, 'the rejected commit stays local');
  }
}
{ // an unspecified strategy is theirs: your conflicting commit is dropped
  const s = table();
  receive(s, 'p0', [{ op: 'add', cards: ['a1'] }, { op: 'commit' }, { op: 'push' }]);
  receive(s, 'p1', [{ op: 'add', cards: ['b1'] }, { op: 'commit' }, { op: 'pull' }]);
  check(s.players.p1.local.length === 0 && s.players.p1.grudges === 0, 'a pull with no declared strategy resolves as theirs');
}
{ // reflog is a trap: armed in your own pack (free), it fires during someone else's force-push
  const s = table();
  const armed = receive(s, 'p0', [{ op: 'add', cards: ['a1'] }, { op: 'commit' }, { op: 'push' }, { op: 'arm' }]);
  check(armed.ops[3].ok && armed.ops[3].spent === 0 && s.players.p0.armed, 'arming a reflog is a free 4th op');
  s.players.p1.local = [{ id: 'bx', author: 'p1', cards: [{ file: 'README.md', lines: 2 }] }];
  const e = receive(s, 'p1', [{ op: 'force' }]);
  check(e.ops[0].reflogs === 1 && !s.players.p0.armed, 'the armed reflog fires once and is spent');
  check(s.main.map(c => c.id).join(' ') === `c0 bx ${s.main[2].id}` && s.main[2].author === 'p0', 'the erased commit comes back on top');
  check(s.players.p1.sin === 1 && behindBy(s, 'p1') === 1, 'the forcer takes a sin and is now behind');
}
{ // games end, pointers stay in range, packs are at most 4 ops, budgets are never overspent
  let games = 0;
  for (const timings of [['early', 'late'], ['random', 'random'], ['race', 'race'], ['race', 'race', 'race', 'race'], ['late', 'late', 'early']])
    for (const mode of ['arrival', 'batch']) for (const rules of [{}, { refundRejectedPush: true, freeFastForward: true }]) for (const defensive of [true, false])
      for (let seed = 1; seed <= 12; seed++) {
        const r = play({ seed, timings, mode, rules, defensive });
        games++;
        check(r.s.over && r.days <= 12, `game ends by day 12 (${timings} ${mode} seed ${seed})`);
        for (const id of r.s.ids) { const ptr = r.s.players[id].ptr; check(ptr >= 1 && ptr <= r.s.main.length, `pointer in range (${timings} seed ${seed})`); }
        for (const e of r.s.log) {
          check(e.ops.length <= 4, 'a pack has at most 4 ops');
          check(spent(e) <= 4, 'a pack never spends more than the largest budget');
        }
      }
  console.log('games played', games);
}

if (failures.length) { console.error(`\n${failures.length} failure(s)`); process.exit(1); }
console.log('pack smoke test green');
