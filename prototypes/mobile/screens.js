// One render function per screen id in the spec (§3). Step 3 of the plan: placeholders that print their event,
// just enough to play a whole game through the router's queue. Each is replaced by the real screen in step 4.
import { legalActions } from './engine.js';
import { esc } from './view.js';
import { suggestMessages } from './copy.js';

const IDS = ['O-Incident', 'O-YourTurn', 'O-Staged', 'O-Committed', 'O-Pushed', 'O-Rejected', 'O-Pulled', 'O-Resolved', 'O-Blamed', 'O-Reverted', 'O-Forced', 'O-Reflog', 'O-TurnSummary', 'O-BotTurn', 'O-BotStep', 'O-Behind', 'O-CI', 'O-Scoreboard'];
const placeholder = id => ({
  html: ({ e }) => `<div class="body"><h1>${id}</h1><pre class="evt">${esc(JSON.stringify(e, null, 1))}</pre></div>
    <div class="actions">${id.startsWith('O-Bot') ? '<button data-skip-bot class="ghost">skip bot</button>' : ''}<button class="primary" data-next>Continue</button></div>`,
});
export const SCREENS = Object.fromEntries(IDS.map(id => [id, placeholder(id)]));

SCREENS['I-Start'] = {
  html: () => `<div class="body"><h1>Git Game</h1><label><input type="checkbox" data-guided checked> guided first game</label></div>
    <div class="actions"><button class="primary" data-new>New game</button></div>`,
  mount: (el, { api }) => { el.querySelector('[data-new]').onclick = () => api.newGame({ guided: el.querySelector('[data-guided]').checked }); },
};

// The placeholder hub offers every enabled op with the simplest arguments, so the flow can be walked end to end.
function simple(o, s) {
  const p = s.players.you;
  if (o.key === 'stage') return { type: 'stage', cards: [p.hand.find(c => !c.cmd).id] };
  if (o.key === 'commit') return { type: 'commit', message: suggestMessages(p.staged)[0] };
  if (o.key === 'blame' || o.key === 'revert') return { ...o.action, target: o.data.targets[0] };
  return o.action;
}
SCREENS['I-Hub'] = {
  html: ({ s }) => `<div class="body"><h1>I-Hub</h1></div><div class="actions stack">${legalActions(s).filter(o => o.enabled).map(o => `<button data-op="${o.key}">${o.key}</button>`).join('')}</div>`,
  mount: (el, { s, api }) => {
    const opts = legalActions(s);
    el.querySelectorAll('[data-op]').forEach(b => { b.onclick = () => api.dispatch(simple(opts.find(o => o.key === b.dataset.op), s)); });
  },
};
SCREENS['I-Conflict'] = {
  html: ({ s }) => `<div class="body"><h1>I-Conflict</h1></div><div class="actions stack">${legalActions(s).filter(o => o.enabled).map(o => `<button data-op="${o.key}">${o.key}</button>`).join('')}</div>`,
  mount: (el, { s, api }) => { el.querySelectorAll('[data-op]').forEach(b => { b.onclick = () => api.dispatch({ type: 'resolve', strategy: b.dataset.op }); }); },
};
