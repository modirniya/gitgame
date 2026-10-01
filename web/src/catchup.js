// What a reader hasn't seen yet: every day that closed since they last looked, played back step by step and ending
// on its receipt (playback.js), then today's incident. Coming back after a week and coming back after a minute are the
// same (charter decision 9): the days are in the view, and all this remembers is how far this reader has read.
//
// That memory is a per-device convenience in localStorage. If it is lost, the days play again; nothing else is.
import { playback } from "./playback.js";
import { coach } from "./copy.js";

/** `memory` is `{logs, opened}`: the last day whose log was read, and the last day opened. */
export function catchup(view, memory = {}) {
  const read = memory.logs ?? 0;
  const you = view.you.player;
  const queue = [];

  view.days.forEach((day, i) => {
    if (day.day <= read) return;
    const next = view.days[i + 1]?.opened ?? view;
    queue.push(...playback(day, view, { you, next }));
  });

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
    };
    queue.push({ kind: "moment", moment: { ...m, coach: coach(m, you) }, day: view.day, mustSee: true, auto: false });
  }

  return {
    queue,
    memory: {
      logs: view.days.at(-1)?.day ?? read,
      opened: view.released ? (memory.opened ?? 0) : view.day,
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
