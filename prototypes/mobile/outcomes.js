// The output screens (spec §3, "O-"): each shows exactly one consequence and moves on by one tap. Titles are the
// Git command that happened; where Git prints something, the screen prints it too; the coach line under the
// scene says what happened and what to do next, in copy.js's words.
import { behindBy, commitsOnMain, scores, lines, hasBug, winner, RELEASE_AT } from './engine.js';
import { handCard, commitCard, strip, scrollStripToTip, pips, esc } from './view.js';
import { SCREEN, INCIDENT, GIT, RECEIPT, REASON, BOT_DID, BOT_TITLE } from './copy.js';

const T = SCREEN;
export const OUTCOMES = {};
export { buzz, findCommit };

// The one layout every consequence uses: title, optional terminal output, the scene, what happened, what next.
export function outcome({ title, tone = '', term = '', scene = '', said = '', then = '', button = 'Continue', guide = 'continue', extra = '' }) {
  return `<div class="body out ${tone}">
      <h1 class="cmd">${title}</h1>
      ${term ? `<pre class="term ${tone}">${esc(term)}</pre>` : ''}
      <div class="scene">${scene}</div>
      ${said ? `<p class="said">${said}</p>` : ''}${then ? `<p class="then">${then}</p>` : ''}${extra}
    </div>
    <div class="actions"><button class="primary" data-next data-guide="${guide}">${button}</button></div>`;
}

OUTCOMES['O-Incident'] = {
  html: ({ e }) => {
    const inc = INCIDENT[e.incident];
    return outcome({
      title: T.incident.title(e.round), button: T.incident.got,
      scene: `<div class="incident-card" data-anim="deal"><div class="band">incident</div><h2>${esc(inc.name)}</h2><p>${esc(inc.text)}</p></div>`,
    });
  },
};

OUTCOMES['O-YourTurn'] = {
  html: ({ e, s }) => outcome({
    title: T.yourTurn.title(e.ops), button: T.yourTurn.play, tone: e.behindBy ? 'warn' : '',
    scene: `<div class="drawn">${e.drawn.map((c, i) => handCard(c, { size: 'lg', data: { 'data-anim': 'draw', style: `--i:${i}` } })).join('')}</div>
      <div class="bigpips">${pips(e.ops, 3, 'you')}</div>`,
    said: e.drawn.length ? T.yourTurn.drew : '',
    then: e.behindBy ? T.yourTurn.behind(behindBy(s, 'you')) : T.yourTurn.atTip,
  }),
};

const buzz = () => { try { navigator.vibrate?.(18); } catch { /* no haptics */ } }; // spec §4: a light tap on reject and blame-hit
const findCommit = (s, id) => s.main.find(c => c.id === id) || s.players.you.local.find(c => c.id === id);

OUTCOMES['O-Staged'] = {
  html: ({ e }) => outcome({
    title: T.staged.title, said: T.staged.said(e.cards.length),
    scene: `<div class="zone big" data-zone="mat">${e.cards.map((c, i) => handCard(c, { size: 'md', data: { 'data-anim': 'stage', style: `--i:${i}` } })).join('')}</div>`,
  }),
};

OUTCOMES['O-Committed'] = {
  html({ e, s, before }) {
    const c = findCommit(s, e.commit), staged = before.players.you.staged;
    const behind = behindBy(s, 'you');
    return outcome({
      title: T.commit.title, term: GIT.commit(c.id, c.message, new Set(c.cards.map(x => x.file)).size, lines(c)),
      scene: `<div class="stack-from">${staged.map((x, i) => handCard(x, { size: 'md', data: { 'data-anim': 'stack', style: `--i:${i}` } })).join('')}</div>
        ${commitCard(c, { size: 'xl', faceUp: true, data: { 'data-anim': 'commit' } })}`,
      said: T.committed.said(c.id, lines(c)) + (e.hasBug ? (e.lazy && !c.cards.some(x => x.bug) ? T.committed.lazy : T.committed.bug) : ''),
      then: behind ? T.committed.behind(behind) : T.committed.atTip,
      tone: e.hasBug ? 'bad' : '',
    });
  },
};

OUTCOMES['O-Pushed'] = {
  html({ e, s }) {
    const sc = scores(s);
    const tag = commitsOnMain(s) >= RELEASE_AT ? (sc.you.total >= sc.bot.total ? T.pushed.tagAhead : T.pushed.tagBehind) : T.pushed.then;
    return outcome({
      title: 'git push', tone: 'good', term: GIT.push(e.from, e.commits[e.commits.length - 1]),
      scene: `${strip(s, { mark: e.commits })}<div class="zone ghostzone" data-zone="local"><span class="k">${T.hub.local}</span></div>`,
      said: (e.roll ? T.pushed.die(e.roll) + ' ' : '') + T.pushed.said(e.commits), then: tag, guide: 'pushed',
    });
  },
  mount: el => scrollStripToTip(el),
};

OUTCOMES['O-Rejected'] = {
  html({ e, s }) {
    const flaky = e.reason === 'flaky';
    return outcome({
      title: 'git push', tone: 'bad', term: flaky ? T.rejected.flakyBanner(e.roll) : GIT.rejected,
      scene: `${strip(s)}<div class="zone ghostzone" data-zone="local">${s.players.you.local.map(c => commitCard(c, { size: 'md', faceUp: true, data: { 'data-anim': 'bounce' } })).join('')}</div>`,
      said: flaky ? T.rejected.flaky(e.roll) : T.rejected.said, then: flaky ? T.rejected.flakyThen : T.rejected.then,
    });
  },
  mount: el => { scrollStripToTip(el); buzz(); },
};

OUTCOMES['O-Resolved'] = {
  html({ e, s, before }) {
    const old = id => before.players.you.local.find(c => c.id === id) || before.main.find(c => c.id === id);
    const scene = {
      ours: e.crossedOut.map(id => commitCard(s.main.find(c => c.id === id), { size: 'lg', data: { 'data-anim': 'cross' } })).join(''),
      theirs: e.discarded.map(id => commitCard(old(id), { size: 'lg', faceUp: true, cls: 'gone', data: { 'data-anim': 'drop' } })).join(''),
      resolve: s.players.you.local.map(c => commitCard(c, { size: 'lg', faceUp: true })).join(''),
    }[e.strategy];
    const lost = e.crossedOut.reduce((a, id) => a + lines(s.main.find(c => c.id === id)), 0);
    return outcome({
      title: e.strategy === 'resolve' ? 'resolved by hand' : `-X ${e.strategy}`, tone: e.strategy === 'ours' ? 'warn' : '',
      scene: `<div class="spread">${scene}</div>`,
      said: e.strategy === 'ours' ? T.resolved.ours(e.crossedOut, lost) : e.strategy === 'theirs' ? T.resolved.theirs(e.discarded) : T.resolved.resolve,
    });
  },
};

OUTCOMES['O-Pulled'] = {
  html({ e, s }) {
    const term = e.rebase ? GIT.rebase : e.hadLocal ? GIT.merge : GIT.fastForward(e.from, e.to);
    return outcome({
      title: e.rebase ? 'git pull --rebase' : 'git pull', term, tone: 'good',
      scene: `${strip(s, { mark: e.incoming })}<div class="token-line" data-anim="token">${e.rebase ? '<span class="tok pos">rebased: clean</span>' : `<span class="tok neg">+1 merge token (${e.mergeTokens})</span>`}</div>`,
      said: `${T.pulled.said} ${e.rebase ? T.pulled.rebase : T.pulled.plain(e.mergeTokens)}`,
      then: s.players.you.local.length ? T.pulled.push : T.pulled.nothing,
    });
  },
  mount: el => scrollStripToTip(el),
};

OUTCOMES['O-Blamed'] = {
  html({ e, s }) {
    const c = s.main.find(x => x.id === e.target);
    return outcome({
      title: `git blame ${e.target}`, tone: e.wasBug ? 'bad' : '',
      scene: `${commitCard(c, { size: 'xl', reveal: true, data: { 'data-anim': 'flip' } })}<span class="stamp ${e.wasBug ? 'bad' : 'ok'}">${e.wasBug ? `${T.blamed.stamp.bug} · −3 ${e.author}` : T.blamed.stamp.clean}</span>`,
      said: e.wasBug ? T.blamed.bug(e.target, e.author) : T.blamed.clean(e.target),
      then: e.wasBug ? T.blamed.bugThen : T.blamed.cleanThen,
    });
  },
  mount: (el, { e }) => { if (e.wasBug) buzz(); },
};

OUTCOMES['O-Reverted'] = {
  html({ e, s }) {
    const t = s.main.find(x => x.id === e.target), rv = s.main.find(x => x.id === e.revert);
    return outcome({
      title: `git revert ${e.target}`, tone: 'good', term: GIT.revert(rv.id, rv.message),
      scene: `<div class="revert-stack">${commitCard(t, { size: 'lg' })}${commitCard(rv, { size: 'lg', data: { 'data-anim': 'land' } })}</div><span class="stamp ok">+1 fix</span>`,
      said: T.reverted.said(e.target), then: T.reverted.then,
    });
  },
};

// Force-push: the erased cards fall off main; whatever the reflog brings back is the next screen's story.
OUTCOMES['O-Forced'] = {
  html({ e, s, before }) {
    const erased = e.erased.map(id => before.main.find(c => c.id === id));
    const mine = e.player === 'you', returned = e.returned.some(id => s.players.you.local.some(c => c.id === id));
    // main as the force left it: a reflog fires in the same instant, but that is the next screen's story
    const n = e.from + e.pushed.length, clamp = p => ({ ...p, ptr: Math.min(p.ptr, n) });
    const view = { ...s, main: s.main.slice(0, n), players: { you: clamp(s.players.you), bot: clamp(s.players.bot) } };
    return outcome({
      title: 'git push --force', tone: 'bad', term: GIT.forced(e.oldTip, e.newTip),
      scene: `${strip(view, { mark: e.pushed })}
        <div class="zone ghostzone fallen" data-zone="erased"><span class="k">erased</span>${erased.map(c => commitCard(c, { size: 'md', cls: 'fallen', data: { 'data-anim': 'fall' } })).join('')}</div>
        <span class="stamp bad">+1 sin · ${e.player}</span>`,
      said: mine ? T.forced.you(e.erased) : T.forced.bot(e.erased, returned),
      then: mine ? T.forced.youThen : T.forced.botThen,
    });
  },
  mount: el => { scrollStripToTip(el); buzz(); },
};

OUTCOMES['O-Reflog'] = {
  html({ e, s }) {
    const mine = e.victim === 'you';
    return outcome({
      title: 'git reflog', tone: mine ? 'good' : 'warn',
      scene: strip(s, { mark: e.restored }),
      said: mine ? T.reflog.you(e.restored) : T.reflog.bot(e.restored), then: mine ? T.reflog.youThen : T.reflog.botThen,
    });
  },
  mount: el => scrollStripToTip(el),
};

OUTCOMES['O-TurnSummary'] = {
  html: ({ e }) => {
    const rows = e.summary.filter(x => RECEIPT[x.type]).map(x => `<li>${esc(RECEIPT[x.type](x))}</li>`).join('');
    const d = e.scoreDelta.you;
    return outcome({
      title: T.summary.title, button: T.summary.watch, guide: 'watch',
      scene: `<ol class="receipt">${rows || `<li>${T.summary.none}</li>`}</ol><span class="stamp ${d > 0 ? 'ok' : d < 0 ? 'bad' : ''}">${T.summary.delta(d)}</span>`,
    });
  },
};

// ---------- the bot's turn: a character you watch think, one op per screen (spec §5) ----------
const botActions = next => `<div class="actions"><button class="ghost" data-skip-bot data-guide="skip">${T.botTurn.skip}</button><button class="primary" data-next data-guide="botnext">${next}</button></div>`;

OUTCOMES['O-BotTurn'] = {
  html: ({ e, s }) => `<div class="body out bot">
      <h1 class="cmd">${T.botTurn.title(e.ops)}</h1>
      <div class="scene"><div class="avatar" aria-hidden="true">bot</div>${pips(e.ops, 3, 'bot')}</div>
      <p class="said">${e.behindBy ? T.botTurn.behind(e.behindBy) : T.botTurn.atTip}</p>
    </div>${botActions('›')}`,
};

OUTCOMES['O-BotStep'] = {
  html({ e, s, item }) {
    const target = e.why.target ? ` ${e.why.target}` : '';
    const did = e.events.map(x => BOT_DID[x.type]?.(x)).filter(Boolean);
    const mark = e.events.flatMap(x => x.type === 'PushAccepted' ? x.commits : x.type === 'Reverted' ? [x.revert, x.target] : x.type === 'Blamed' ? [x.target] : []);
    const left = s.turn === 'bot' && !s.over ? s.ops : 0, of = item.of ?? 3;
    const bad = e.events.some(x => (x.type === 'Blamed' && x.author === 'you' && x.wasBug) || (x.type === 'ConflictResolved' && x.strategy === 'ours'));
    return `<div class="body out bot ${bad ? 'bad' : ''}">
        <h1 class="cmd">${e.op === 'end' ? T.botStep.end : BOT_TITLE[e.op] + target}</h1>
        <div class="dots" aria-label="${T.botStep.of(of - left, of)}">${Array.from({ length: of }, (_, i) => `<i class="${i < of - left ? 'on' : ''}"></i>`).join('')}<span>${T.botStep.of(of - left, of)}</span></div>
        <div class="scene">${strip(s, { mark })}</div>
        <div class="bubble"><span class="avatar small" aria-hidden="true">bot</span><p>${REASON.bot[e.op](e.why)}</p></div>
        ${did.length ? `<p class="said">${did.join(' ')}</p>` : ''}
      </div>${botActions('›')}`;
  },
  mount: el => scrollStripToTip(el),
};

OUTCOMES['O-Behind'] = {
  html: ({ e, s }) => outcome({
    title: T.behind.title, tone: 'warn', button: T.behind.got, guide: 'behind',
    scene: strip(s, { mark: s.main.slice(s.players.you.ptr).map(c => c.id) }),
    said: T.behind.said(behindBy(s, 'you') || e.behindBy),
  }),
  mount: el => scrollStripToTip(el),
};

// ---------- the release ----------
const FLIP_MS = 250; // spec §4: every face-down card flips in order, 250 ms apart
OUTCOMES['O-CI'] = {
  html({ e, s }) {
    const counts = new Set(e.flips.filter(f => f.counts).map(f => f.id));
    const cells = s.main.filter(c => !c.init).map(c => `<div class="ci-cell">${commitCard(c, { size: 'sm', reveal: true, cls: counts.has(c.id) ? 'counts' : '', data: { 'data-anim': 'ci' } })}</div>`).join('');
    return outcome({
      title: e.by ? 'git tag v1.0' : T.ci.title, tone: e.productionDown ? 'bad' : 'good', term: e.by ? '' : T.ci.deadline,
      scene: `<div class="ci-grid">${cells}</div><span class="stamp ${e.bugs ? 'bad' : 'ok'}" data-anim="tally">${T.ci.bugs(e.bugs)}</span>`,
      said: e.productionDown ? T.ci.down : T.ci.ship, button: T.ci.score, guide: 'ci',
    });
  },
  // Long enough for every flip to land and the tally to be read.
  auto: ({ e }) => e.flips.length * FLIP_MS + 2600,
};

OUTCOMES['O-Scoreboard'] = {
  html({ e, s }) {
    const sc = scores(s), w = winner(s), you = s.players.you, bot = s.players.bot;
    const row = k => `<tr><td>${T.score.rows[k]}</td><td>${sc.you[k]}</td><td>${sc.bot[k]}</td></tr>`;
    const d = T.score.decided, why = [];
    if (Math.abs(sc.you.merge - sc.bot.merge) >= 2) why.push(d.merge(-sc.you.merge, -sc.bot.merge));
    if (Math.abs(sc.you.blame - sc.bot.blame) >= 3) why.push(d.blame(-sc.you.blame, -sc.bot.blame));
    if (Math.abs(sc.you.lines - sc.bot.lines) >= 4) why.push(d.lines(sc.you.lines, sc.bot.lines));
    if (you.sin || bot.sin) why.push(d.sin);
    const hand = p => [...p.hand, ...p.staged].map(c => handCard(c, { size: 'sm' })).join('') || `<span class="empty">${T.hub.empty}</span>`;
    return `<div class="body out score">
        <h1 class="cmd">${e.productionDown ? T.score.down(e.bugs) : T.score.shipped}</h1>
        <p class="winner ${w}">${T.score.win[w]}</p>
        <table class="scores"><thead><tr><th></th><th class="you">you</th><th class="bot">bot</th></tr></thead>
          <tbody>${['lines', 'fixes', 'blame', 'merge', 'grudge', 'sin'].map(row).join('')}</tbody>
          <tfoot><tr><td>total</td><td>${sc.you.total}</td><td>${sc.bot.total}</td></tr></tfoot></table>
        <p class="said">${why.length ? T.score.decidedBy(why) : d.none}</p>
        <h2 class="k">${T.score.hands}</h2>
        <div class="hands"><div><b class="you">you</b><div class="zcards">${hand(you)}</div></div><div><b class="bot">bot</b><div class="zcards">${hand(bot)}</div></div></div>
        <p class="fine">${T.start.seed(s.seed)}</p>
        <div data-playtest></div>
      </div>
      <div class="actions"><button class="ghost" data-replay>${T.score.replay}</button><button class="primary" data-again data-guide="again">${T.score.again}</button></div>`;
  },
  mount(el, { s, api }) {
    try { localStorage.setItem('gitgame.games', String(+(localStorage.getItem('gitgame.games') || 0) + 1)); } catch { /* private mode */ }
    el.querySelector('[data-again]').onclick = () => api.next();
    el.querySelector('[data-replay]').onclick = () => api.newGame({ seed: s.seed, guided: s.guided });
  },
};
