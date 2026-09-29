// The output screens (spec §3, "O-"): each shows exactly one consequence and moves on by one tap. Titles are the
// Git command that happened; where Git prints something, the screen prints it too; the coach line under the
// scene says what happened and what to do next, in copy.js's words.
import { behindBy } from './engine.js';
import { handCard, pips, esc } from './view.js';
import { SCREEN, INCIDENT } from './copy.js';

const T = SCREEN;
export const OUTCOMES = {};

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

// Placeholders until their group of the plan replaces them.
const IDS = ['O-Staged', 'O-Committed', 'O-Pushed', 'O-Rejected', 'O-Pulled', 'O-Resolved', 'O-Blamed', 'O-Reverted', 'O-Forced', 'O-Reflog', 'O-TurnSummary', 'O-BotTurn', 'O-BotStep', 'O-Behind', 'O-CI', 'O-Scoreboard'];
for (const id of IDS) OUTCOMES[id] = {
  html: ({ e }) => `<div class="body"><h1>${id}</h1><pre class="evt">${esc(JSON.stringify(e, null, 1))}</pre></div>
    <div class="actions">${id.startsWith('O-Bot') ? '<button data-skip-bot class="ghost">skip bot</button>' : ''}<button class="primary" data-next>Continue</button></div>`,
};
