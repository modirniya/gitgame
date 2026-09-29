// Records what the spec's open questions (§8) need, per game, on this device: how long each screen was looked at
// and how it was left (tap, auto-advance, skip), how often "skip bot" was pressed, when the Table sheet was opened,
// and how long O-Behind was read in game 1, 2, 3… Nothing leaves the browser; the scoreboard shows the numbers and
// window.gitgamePlaytest() returns them as JSON to paste into the findings.
const KEY = 'gitgame.playtest';
const FAST = 800; // ms: a consequence screen left sooner than this was tapped through, not read
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
const save = games => { try { localStorage.setItem(KEY, JSON.stringify(games.slice(-20))); } catch { /* private mode: this game only */ } };

export function install(api) {
  const games = load();
  let game = null, entered = 0;
  api.on((kind, x, how) => {
    if (kind === 'newGame') { game = { n: games.length + 1, guided: !!x.guided, seed: x.seed, screens: {}, skips: 0, tables: [], behind: [], started: Date.now() }; games.push(game); }
    if (!game) return;
    if (kind === 'enter') entered = performance.now();
    if (kind === 'leave') {
      const ms = Math.round(performance.now() - entered), r = (game.screens[x.id] ||= { seen: 0, ms: 0, fast: 0, auto: 0, skip: 0 });
      r.seen++; r.ms += ms;
      if (how === 'auto') r.auto++; else if (how === 'skip') r.skip++; else if (ms < FAST && x.id.startsWith('O-')) r.fast++;
      if (x.id === 'O-Behind') game.behind.push(ms);
    }
    if (kind === 'skip') game.skips++;
    if (kind === 'table') game.tables.push(x.id);
    if (kind === 'events' && x.some(e => e.type === 'CIRan')) { game.minutes = +((Date.now() - game.started) / 60000).toFixed(1); save(games); }
  });
  window.gitgamePlaytest = () => JSON.parse(JSON.stringify(games));
}

// The last few games, as the scoreboard's "playtest numbers": the rows that answer the open questions.
export function summary() {
  const games = load().slice(-5);
  if (!games.length) return '';
  const rows = games.map(g => {
    const all = Object.values(g.screens), seen = all.reduce((a, r) => a + r.seen, 0), fast = all.reduce((a, r) => a + r.fast, 0);
    const bot = (g.screens['O-BotStep'] || { seen: 0, skip: 0 });
    return `<tr><td>${g.n}${g.guided ? 'g' : ''}</td><td>${g.minutes ?? '–'}</td><td>${seen}</td><td>${fast}</td><td>${g.skips}</td><td>${bot.seen}</td><td>${g.behind.map(ms => (ms / 1000).toFixed(1)).join(' ') || '–'}</td><td>${g.tables.length}</td></tr>`;
  }).join('');
  return `<details class="playtest"><summary>playtest numbers (this device)</summary>
    <table><thead><tr><th>game</th><th>min</th><th>screens</th><th>tapped through</th><th>skip bot</th><th>bot steps watched</th><th>O-Behind s</th><th>table</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="fine">"Tapped through" is a consequence screen left in under ${FAST / 1000} s. window.gitgamePlaytest() has the full record.</p></details>`;
}
