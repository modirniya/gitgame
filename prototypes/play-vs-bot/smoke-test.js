// Smoke test for index.html: auto-plays games in node with a stubbed DOM.
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const js = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
const stub = () => ({ set innerHTML(v) { this._h = v; }, get innerHTML() { return this._h || ''; }, querySelectorAll: () => [], hidden: false, onclick: null, scrollTop: 0, scrollHeight: 0, dataset: {}, className: '' });
global.document = { getElementById: () => stub(), querySelector: () => stub(), querySelectorAll: () => [] };
global.setTimeout = () => {};
eval(js + `
function playYou(mode) {
  const you = S.players.you; let inner = 0;
  while (S.ops > 0 && !S.over && inner++ < 10) {
    let pl;
    if (mode === 'smart') pl = plan('you');
    else {
      const behind = behindBy(you); const opts = [];
      if (you.local.length) opts.push({ op: 'push' });
      if (behind) { const conf = conflictsFor(you); const strat = conf.length ? ['ours', 'theirs', 'resolve'][Math.floor(Math.random() * 3)] : null; if (!(strat === 'resolve' && S.ops < 2)) opts.push({ op: 'pull', strategy: strat }); if (S.ops >= 2 && !(strat === 'resolve' && S.ops < 3)) opts.push({ op: 'rebase', strategy: strat }); }
      if (you.staged.length) opts.push({ op: 'commit' });
      const cc = you.hand.filter(c => !c.cmd); if (cc.length) opts.push({ op: 'add', cards: cc.slice(0, 1 + Math.floor(Math.random() * 2)) });
      if (hasCmd(you, 'git blame') && S.incident.id !== 'sodown') { const t = S.main.filter(c => !c.init && !c.revertOf && !c.flipped && !c.overwritten)[0]; if (t) opts.push({ op: 'blame', target: t }); }
      if (hasCmd(you, 'revert') && S.incident.id !== 'sodown' && !behind) { const t = S.main.find(c => c.flipped && isBug(c)); if (t) opts.push({ op: 'revert', target: t }); }
      if (hasCmd(you, 'push --force') && S.incident.id !== 'sodown' && behind) opts.push({ op: 'force' });
      if (commits() >= RELEASE_AT) opts.push({ op: 'tag' });
      if (!opts.length) break; pl = opts[Math.floor(Math.random() * opts.length)];
    }
    if (pl.op === 'end') break;
    snapshot(); execute('you', pl); render();
    if (mode === 'random' && Math.random() < 0.1 && history.length) undo();
    for (const p of Object.values(S.players)) if (p.ptr > S.main.length || p.ptr < 1) throw new Error('ptr out of range ' + p.id + ' ' + p.ptr + '/' + S.main.length);
  }
}
function run(N, mode) {
  const st = { tagYou: 0, tagBot: 0, deadline: 0, down: 0, wins: { you: 0, bot: 0, draw: 0 }, forces: 0, reflogs: 0, errors: 0 };
  for (let g = 0; g < N; g++) {
    try {
      tutorialOn = false; newGame(); let guard = 0;
      while (!S.over && guard++ < 3000) {
        if (S.turn === 'you') { playYou(mode); if (S.over) break; S.ops = 0; beginTurn('bot'); botTurnSync(); render(); if (S.over) break; if (S.round >= MAX_ROUNDS) { release(); break; } startRound(); }
        else botTurnSync();
      }
      if (!S.over) throw new Error('unfinished');
      const tagged = S.log.find(l => l.text.includes('git tag v1.0 by')); if (tagged && tagged.text.includes('You')) st.tagYou++; else if (tagged) st.tagBot++; else st.deadline++;
      if (S.released.down) st.down++;
      const sc = scores(); if (sc.you.total > sc.bot.total) st.wins.you++; else if (sc.you.total < sc.bot.total) st.wins.bot++; else st.wins.draw++;
      st.forces += S.log.filter(l => l.text.includes('--force')).length; st.reflogs += S.log.filter(l => l.text.includes('plays reflog')).length;
    } catch (e) { st.errors++; if (st.errors < 3) console.error('ERR', e.stack.split('\\n').slice(0, 3).join(' | ')); }
  }
  return st;
}
console.log('smart :', JSON.stringify(run(400, 'smart')));
console.log('random:', JSON.stringify(run(400, 'random')));

// guided game: after turn 1 (add, commit, push) and the bot's turn, the guide must be in a reachable state
let ok = 0, pulls = 0, alt = 0;
for (let g = 0; g < 200; g++) {
  tutorialOn = true; newGame();
  if (S.incident.id !== 'quiet') throw new Error('guided round 1 incident not quiet');
  const you = S.players.you; const c = you.hand.find(x => !x.cmd && !x.bug) || you.hand.find(x => !x.cmd);
  tutorAdvance('select'); doAdd('you', [c]); tutorAdvance('add'); doCommit('you'); tutorAdvance('commit'); doPush('you'); tutorAdvance('push');
  if (tutorExpect() !== 'watch') throw new Error('expected watch, got ' + tutorExpect());
  finishYourTurn(); botTurnSync(); startRound();
  const e = tutorExpect();
  if (e === 'pull' && behindBy(you) > 0) pulls++; else if (e === 'select' && behindBy(you) === 0) alt++; else throw new Error('tutorial state ' + e + ' behind ' + behindBy(you));
  ok++;
}
console.log('guided turn-2:', { ok, pullLesson: pulls, skippedToSelect: alt });

// one reflog card restores everything of the victim's that was erased
tutorialOn = false; newGame();
const you = S.players.you, bot = S.players.bot;
you.hand = [{ cmd: 'reflog' }]; bot.hand = [{ cmd: 'push --force' }];
S.main.push({ id: 'Y1', author: 'you', cards: [{ file: 'auth.js', lines: 4 }], flipped: false }, { id: 'Y2', author: 'you', cards: [{ file: 'api.py', lines: 3 }], flipped: false });
you.ptr = 3; bot.ptr = 1; bot.local = [{ id: 'B1', author: 'bot', cards: [{ file: 'README.md', lines: 2 }], flipped: false }]; S.ops = 3;
doForce('bot');
console.log('after force:', S.main.map(c => c.id).join(' '), '| you.ptr', you.ptr, 'bot.ptr', bot.ptr, '| reflog cards left', you.hand.length, '| bot sin', bot.sin);
`);
