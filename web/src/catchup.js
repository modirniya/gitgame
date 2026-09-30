// What a reader hasn't seen yet: the screens of every day that closed since they last looked, then today's incident.
// Coming back after a week and coming back after a minute are the same (charter decision 9): the days are in the view,
// and all this remembers is how far this reader has read, and which kinds of moment they have had a screen for.
//
// That memory is a per-device convenience in localStorage. If it is lost, the screens show again; nothing else is.
import { moments } from "./moments.js";
import { coach } from "./copy.js";

/** `memory` is `{logs, opened, seen}`: the last day whose log was read, the last day opened, the kinds seen. */
export function catchup(view, memory = {}) {
  const read = memory.logs ?? 0;
  let seen = new Set(memory.seen ?? []);
  const queue = [];

  for (const day of view.days.filter((d) => d.day > read)) {
    const r = moments(day.log, { you: view.you.player, seen, bots: view.bots ?? [] });
    seen = r.seen;
    queue.push(...r.moments.filter((m) => m.screen));
  }

  const opening = view.today.find((e) => e.type === "day_opened");
  if (!view.released && opening && view.day > (memory.opened ?? 0)) {
    const m = {
      kind: "incident",
      player: null,
      command: null,
      output: [],
      tone: "warn",
      events: [opening],
      day: view.day,
      screen: true,
    };
    queue.push({ ...m, coach: coach(m, view.you.player) });
  }

  return {
    queue,
    memory: {
      logs: view.days.at(-1)?.day ?? read,
      opened: view.released ? (memory.opened ?? 0) : view.day,
      seen: [...seen],
    },
  };
}

const key = (id, player) => `gitgame:${id}:${player}`;

export function recall(id, player) {
  try {
    return JSON.parse(localStorage.getItem(key(id, player))) ?? {};
  } catch {
    return {};
  }
}

export function remember(id, player, memory) {
  try {
    localStorage.setItem(key(id, player), JSON.stringify(memory));
  } catch {
    // private mode or storage off: the screens will simply show again next time
  }
}
