// Runs the pack model thousands of times to answer the charter's playtest questions 1 and 2 with numbers:
// does sending your pack last dominate, and is paying for a rejected push punishing? `node sim.js` prints the
// tables in README.md; `node sim.js --detail` the diagnostics behind its findings (who pushes on which day, batching
// with and without the fast-forward rule); `node sim.js --v02` the rules v0.2 comparison; `node sim.js --quick` runs a few games of each experiment as a smoke test.
//
// The timing model: each day every player has a send time in [0, 1] (the deadline is 1) and fetches the remote
// `compose` earlier, then writes the whole pack against what they saw. Packs resolve in send order, so anything that
// arrives between your fetch and your send makes your pack stale. `compose` is small for a 24h day (you fetch, write
// and send within a minute) and large for a 60s live day (you spend 20 of the 60 seconds writing).
import { createGame, startDay, endDay, receive, winners, scores, random, DAYS } from './remote.js';
import { writePack } from './packer.js';

// When a player fetches and sends, as a strategy (times in days; the deadline is 1).
// - early: fetch and send at once, first thing — you see only what yesterday left.
// - late: wait until everyone who isn't waiting has sent, then fetch and send near the deadline — you see everything.
// - random: fetch and send at a random moment, writing for `compose` before sending (a 24h game).
// - race: everyone fetches when the day opens and sends the moment the pack is written (a 60s live game): the
//   fastest writer lands first, and everyone else's pack was written against a tip that has since moved.
const TIMING = {
  early: s => { const t = random(s) * 0.1; return { fetch: t, send: t }; },
  late: s => { const t = 1 - random(s) * 0.05; return { fetch: t, send: t }; },
  random: (s, compose) => { const t = random(s) * 0.9; return { fetch: Math.max(0, t - compose), send: t }; },
  race: s => ({ fetch: 0, send: 0.1 + random(s) * 0.3 }),
};

export function play({ seed, timings, compose = 0.02, mode = 'arrival', rules = {}, defensive = true, fallback = false, forceAt = 2 }) {
  const s = createGame({ seed, players: timings.length, rules });
  const stats = { landed: 0, rejected: 0, stale: 0, lostOps: 0, conflicts: 0, forces: 0, reflogs: 0, emptyPacks: 0, packs: 0, sendRank: Object.fromEntries(s.ids.map(id => [id, 0])) };
  while (!s.over) {
    startDay(s);
    const plan = s.ids.map((id, i) => {
      const t = TIMING[timings[i]](s, compose);
      // batch (question 1's alternative): everyone writes against the day's start, the remote resolves at the deadline
      return mode === 'batch' ? { id, fetch: 0, send: 1 + random(s) } : { id, ...t };
    });
    const steps = plan.flatMap(x => [{ t: x.fetch, kind: 'fetch', x }, { t: x.send, kind: 'send', x }]).sort((a, b) => a.t - b.t || (a.kind === 'fetch' ? -1 : 1));
    for (const st of steps) {
      if (s.over) break;
      if (st.kind === 'fetch') st.x.pack = writePack(structuredClone(s), st.x.id, { defensive, fallback, forceAt: typeof forceAt === 'object' ? forceAt[st.x.id] ?? 2 : forceAt });
      else {
        const e = receive(s, st.x.id, st.x.pack);
        stats.packs++;
        for (const o of e.ops) {
          if (o.rejected) { stats.rejected++; stats.lostOps += o.spent; if (o.why.includes('non-fast-forward')) stats.stale++; }
          if (o.conflicts) stats.conflicts++;
          if (o.pushed) stats.landed++;
          if (o.op === 'force' && o.ok) { stats.forces++; stats.reflogs += o.reflogs; }
        }
        if (!e.ops.some(o => o.ok && !o.noop)) stats.emptyPacks++;
      }
    }
    plan.slice().sort((a, b) => a.send - b.send).forEach((x, rank) => { stats.sendRank[x.id] += rank; });
    endDay(s);
  }
  return { s, stats, win: winners(s), days: s.day, tagged: !!s.released.by, down: s.released.down, sc: scores(s) };
}

// Plays N games per condition, rotating which seat gets which timing so the deal can't favour a strategy.
export function experiment({ N, timings, ...opts }) {
  const byStrategy = {}, total = { landed: 0, rejected: 0, stale: 0, lostOps: 0, conflicts: 0, forces: 0, reflogs: 0, emptyPacks: 0, packs: 0, days: 0, tagged: 0, down: 0, merge: 0 };
  for (let g = 0; g < N; g++) {
    const shift = g % timings.length, seats = timings.map((_, i) => timings[(i + shift) % timings.length]);
    const r = play({ seed: 1 + g, timings: seats, ...opts });
    r.s.ids.forEach((id, i) => {
      const k = seats[i], b = (byStrategy[k] ||= { seats: 0, wins: 0, merge: 0, landed: 0, score: 0 });
      b.seats++; if (r.win.includes(id)) b.wins += 1 / r.win.length;
      b.merge += r.s.players[id].merge; b.score += r.sc[id];
      b.landed += r.s.log.filter(e => e.player === id).reduce((n, e) => n + e.ops.filter(o => o.pushed).length, 0);
      total.merge += r.s.players[id].merge;
    });
    for (const k of ['landed', 'rejected', 'stale', 'lostOps', 'conflicts', 'forces', 'reflogs', 'emptyPacks', 'packs']) total[k] += r.stats[k];
    total.days += r.days; total.tagged += r.tagged; total.down += r.down;
  }
  return { byStrategy, per: k => total[k] / N, total, N };
}

// ---------- the report ----------
const pct = x => (100 * x).toFixed(1) + '%';
const ci = (w, n) => '±' + (196 * Math.sqrt(Math.max(w / n * (1 - w / n), 1e-9) / n)).toFixed(1);
function share(r, k) { const b = r.byStrategy[k]; return `${pct(b.wins / b.seats)} ${ci(b.wins, b.seats)}`; }
const expected = r => { const n = Object.values(r.byStrategy).reduce((a, b) => a + b.seats, 0) / r.N; return pct(1 / n); };

// Where the first sender's edge comes from, and what batching costs: 2,000 games per row.
function detail() {
  const N = 2000, t = ['early', 'late'], perDay = { early: [0, 0, 0, 0], late: [0, 0, 0, 0] };
  for (let seed = 1; seed <= N; seed++) for (const e of play({ seed, timings: t }).s.log) if (e.day <= 4 && e.ops.some(o => o.pushed)) perDay[t[+e.player[1]]][e.day - 1]++;
  console.log('Share of games with a landed push, days 1-4 (early vs late, arrival order):');
  for (const [k, v] of Object.entries(perDay)) console.log(`  ${k}: ${v.map(x => pct(x / N)).join(', ')}`);
  console.log('\n| condition | wins, first / second strategy | merge tokens / game | conflicts / game | pushes landed / game | days |\n|---|---|---|---|---|---|');
  for (const [label, o] of [
    ['2 players, arrival order (today)', { timings: t }], ['2 players, batched', { timings: t, mode: 'batch' }],
    ['2 players, batched, no merge token for a fast-forward', { timings: t, mode: 'batch', rules: { freeFastForward: true } }],
    ['4 players, arrival order (today)', { timings: ['early', 'early', 'late', 'late'] }], ['4 players, batched', { timings: ['early', 'early', 'late', 'late'], mode: 'batch' }],
    ['4 players, batched, no merge token for a fast-forward', { timings: ['early', 'early', 'late', 'late'], mode: 'batch', rules: { freeFastForward: true } }],
  ]) {
    const r = experiment({ N, ...o }), w = Object.entries(r.byStrategy).map(([k, b]) => `${k} ${pct(b.wins / b.seats)}`).join(' / ');
    console.log(`| ${label} | ${w} | ${r.per('merge').toFixed(1)} | ${r.per('conflicts').toFixed(2)} | ${r.per('landed').toFixed(1)} | ${r.per('days').toFixed(1)} |`);
  }
}

// Rules v0.1 against the v0.2 decisions (batch at the deadline, no merge token for a fast-forward, 5 force-push cards
// and 4 reflogs, a hand limit of 10), one change at a time and together. 4,000 games per row.
function v02() {
  const N = 4000, hand = r => r.s.ids.reduce((a, id) => a + r.s.players[id].hand.length, 0) / r.s.ids.length;
  const V02 = { freeFastForward: true, forceCards: 5, reflogCards: 4, handLimit: 10 };
  console.log('| rules | players | force-pushes / game | reflogs fired / game | games with a force-push | merge tokens / game | conflicts / game | hand at the end | days | seat spread |\n|---|---|---|---|---|---|---|---|---|---|');
  for (const n of [2, 4]) for (const [label, mode, rules] of [
    ['v0.1 (arrival order, today)', 'arrival', {}], ['v0.1 batched', 'batch', {}], ['+ no merge token for a fast-forward', 'batch', { freeFastForward: true }],
    ['+ 5 force-push / 4 reflog cards', 'batch', { freeFastForward: true, forceCards: 5, reflogCards: 4 }], ['v0.2 (all of it, + hand limit 10)', 'batch', V02],
  ]) {
    let forces = 0, reflogs = 0, withForce = 0, merge = 0, conflicts = 0, handEnd = 0, days = 0; const wins = Array(n).fill(0);
    for (let g = 0; g < N; g++) {
      const r = play({ seed: 1 + g, timings: Array(n).fill('random'), mode, rules });
      forces += r.stats.forces; reflogs += r.stats.reflogs; withForce += r.stats.forces > 0; conflicts += r.stats.conflicts; days += r.days; handEnd += hand(r);
      r.s.ids.forEach((id, i) => { merge += r.s.players[id].merge; if (r.win.includes(id)) wins[i] += 1 / r.win.length; });
    }
    const spread = (Math.max(...wins) - Math.min(...wins)) / N;
    console.log(`| ${label} | ${n} | ${(forces / N).toFixed(3)} | ${(reflogs / N).toFixed(3)} | ${pct(withForce / N)} | ${(merge / N).toFixed(1)} | ${(conflicts / N).toFixed(2)} | ${(handEnd / N).toFixed(1)} | ${(days / N).toFixed(1)} | ${pct(spread)} |`);
  }
  // Is force-pushing over a single commit good play, or just more drama? One writer of each, seats alternating.
  let f1 = 0, games = 0, agg = 0;
  for (let g = 0; g < N; g++) {
    const bold = g % 2 ? 'p1' : 'p0', r = play({ seed: 1 + g, timings: ['random', 'random'], mode: 'batch', rules: V02, forceAt: { [bold]: 1 } });
    f1 += r.stats.forces; games += r.stats.forces > 0; if (r.win.includes(bold)) agg += 1 / r.win.length;
  }
  console.log(`\nv0.2, 2 players, one writer force-pushes over a single commit: ${(f1 / N).toFixed(2)} force-pushes a game, in ${pct(games / N)} of games; that writer wins ${pct(agg / N)} ${ci(agg, N)}.`);
}

function main() {
  if (process.argv.includes('--detail')) return detail();
  if (process.argv.includes('--v02')) return v02();
  const quick = process.argv.includes('--quick'), N = quick ? 40 : 4000;
  const row = (label, r, a, b) => `| ${label} | ${a}: ${share(r, a)} | ${b}: ${share(r, b)} | ${r.per('stale').toFixed(2)} | ${r.per('lostOps').toFixed(2)} | ${r.per('landed').toFixed(2)} | ${r.per('days').toFixed(1)} | ${(r.per('merge')).toFixed(1)} |`;
  const head = (a, b) => `| condition | ${a} strategy wins | ${b} strategy wins | non-fast-forward rejections / game | ops lost to rejections | pushes landed / game | days | merge tokens / game |\n|---|---|---|---|---|---|---|---|`;
  const out = [];
  const cond = (label, o) => ({ label, r: experiment({ N, ...o }) });

  out.push(`## Q1 · Does sending last dominate? (2 players, ${N} games each; an even split is 50%)\n`);
  out.push(head('first', 'second'));
  for (const { label, r } of [
    cond('early vs late (24h: one sends at dawn, the other waits for them)', { timings: ['early', 'late'] }),
    cond('early vs random (24h)', { timings: ['early', 'random'] }),
    cond('late vs late (24h: both wait, the deadline decides the order)', { timings: ['late', 'late'] }),
  ]) out.push(row(label, r, ...Object.keys(r.byStrategy).concat(Object.keys(r.byStrategy)).slice(0, 2)));

  out.push(`\n### Why: pushes landed and merge tokens per player, per game (2 players)\n`);
  out.push('| condition | strategy | wins | pushes landed | merge tokens | final score |\n|---|---|---|---|---|---|');
  for (const { label, r } of [cond('arrival order (today)', { timings: ['early', 'late'] }), cond('batched at the deadline', { timings: ['early', 'late'], mode: 'batch' })])
    for (const [k, b] of Object.entries(r.byStrategy)) out.push(`| ${label} | ${k} | ${pct(b.wins / b.seats)} | ${(b.landed / b.seats).toFixed(2)} | ${(b.merge / b.seats).toFixed(2)} | ${(b.score / b.seats).toFixed(1)} |`);

  out.push(`\n## Q1 with more players (4 players, two of each; an even split is 25%)\n`);
  out.push(head('first', 'second'));
  for (const { label, r } of [
    cond('early ×2 vs late ×2', { timings: ['early', 'early', 'late', 'late'] }),
    cond('random ×2 vs late ×2', { timings: ['random', 'random', 'late', 'late'] }),
  ]) out.push(row(label, r, ...Object.keys(r.byStrategy)));

  out.push(`\n## Q1's alternative: batch at the deadline (everyone writes against the day's start, random order)\n`);
  out.push(head('first', 'second'));
  for (const { label, r } of [
    cond('2 players, early vs late, arrival order (today)', { timings: ['early', 'late'] }),
    cond('2 players, batched', { timings: ['early', 'late'], mode: 'batch' }),
    cond('4 players, arrival order (today)', { timings: ['early', 'early', 'late', 'late'] }),
    cond('4 players, batched', { timings: ['early', 'early', 'late', 'late'], mode: 'batch' }),
  ]) out.push(row(label, r, ...Object.keys(r.byStrategy)));

  out.push(`\n## Q2 · Pay for a rejected push, or refund it? (stale packs: a live race, and a 24h game at random times)\n`);
  out.push(head('first', 'second'));
  for (const { label, r } of [
    cond('live race, naive packs, pay (today)', { timings: ['race', 'race'], defensive: false }),
    cond('live race, naive packs, refund', { timings: ['race', 'race'], defensive: false, rules: { refundRejectedPush: true } }),
    cond('live race, naive + fallback pull, pay (today)', { timings: ['race', 'race'], defensive: false, fallback: true }),
    cond('live race, naive + fallback pull, refund', { timings: ['race', 'race'], defensive: false, fallback: true, rules: { refundRejectedPush: true } }),
    cond('live race, defensive packs, pay (today)', { timings: ['race', 'race'] }),
    cond('live race, defensive packs, refund', { timings: ['race', 'race'], rules: { refundRejectedPush: true } }),
    cond('live race, 4 players, defensive, pay (today)', { timings: ['race', 'race', 'race', 'race'] }),
    cond('live race, 4 players, defensive, refund', { timings: ['race', 'race', 'race', 'race'], rules: { refundRejectedPush: true } }),
    cond('24h random times, 1h to write, naive, pay (today)', { timings: ['random', 'random'], compose: 0.04, defensive: false }),
    cond('24h random times, 1h to write, naive, refund', { timings: ['random', 'random'], compose: 0.04, defensive: false, rules: { refundRejectedPush: true } }),
    cond('24h random times, 1h to write, naive + fallback, pay (today)', { timings: ['random', 'random'], compose: 0.04, defensive: false, fallback: true }),
    cond('24h random times, 1h to write, naive + fallback, refund', { timings: ['random', 'random'], compose: 0.04, defensive: false, fallback: true, rules: { refundRejectedPush: true } }),
  ]) out.push(row(label, r, ...Object.keys(r.byStrategy).concat(Object.keys(r.byStrategy)).slice(0, 2)));

  out.push(`\n## The fast-forward finding from prototypes/mobile, in the pack model (2 players, live race)\n`);
  out.push(head('first', 'second'));
  for (const { label, r } of [
    cond('a plain pull always takes a merge token (today)', { timings: ['race', 'race'] }),
    cond('a fast-forward pull takes no token', { timings: ['race', 'race'], rules: { freeFastForward: true } }),
  ]) out.push(row(label, r, ...Object.keys(r.byStrategy).concat(Object.keys(r.byStrategy)).slice(0, 2)));

  console.log(out.join('\n'));
  if (quick) console.log('\npack simulation smoke run ok');
}
if (import.meta.url === `file://${process.argv[1]}`) main();
