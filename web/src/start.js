// I-Start (event-screens §3): a new game in a few seconds (charter priority 2). You take the first seat, as the
// player this device is signed in as (ADR-0005); anyone else at the device can take a seat too (hotseat), and the
// remote plays the bots.
import { el } from "./dom.js";
import { name } from "./brand.js";
import { whoami } from "./whoami.js";

const LENGTHS = [
  ["live", "live · 60s days"],
  ["lunch", "lunch · 5m days"],
  ["correspondence", "correspondence · 24h days"],
];

/** The seats a form's answers make: you, then the others at this device in the order typed, then `bots` bots. */
export function seatsFrom(you, others, bots) {
  const hotseat = others
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const robots = Array.from({ length: bots }, (_, i) => (bots === 1 ? "bot" : `bot-${i + 1}`));
  const seats = [you, ...hotseat, ...robots];

  if (seats.length < 2 || seats.length > 5) return { error: "fatal: a game has 2 to 5 seats" };
  if (new Set(seats).size !== seats.length) return { error: "fatal: every seat needs its own name" };
  return { seats, hotseat, bots: robots };
}

/** `me` is this device's `{player, link_github}`, or null with `failure` when the remote couldn't be reached. */
export function startScreen({ remote, go, me, failure = null, notice = "", signOut }) {
  const others = el("input", { id: "others", value: "", autocomplete: "off", spellcheck: "false" });
  const bots = el(
    "select",
    { id: "bots" },
    [0, 1, 2, 3].map((n) => el("option", { value: n, selected: n === 1 }, n)),
  );
  const length = el(
    "select",
    { id: "length" },
    LENGTHS.map(([v, label]) => el("option", { value: v }, label)),
  );
  const error = el("p", { class: "error", role: "alert" }, failure?.message ?? notice);
  const button = el("button", { class: "primary", type: "submit", disabled: !me }, "git init");

  async function submit(event) {
    event.preventDefault();
    const answer = seatsFrom(me.player.handle, others.value, Number(bots.value));
    if (answer.error) return (error.textContent = answer.error);

    button.disabled = true;
    error.textContent = "";
    try {
      const view = await remote.createGame({ hotseat: answer.hotseat, bots: answer.bots, dayLength: length.value });
      go(`/g/${view.id}`);
    } catch (e) {
      error.textContent = e.message;
      button.disabled = false;
    }
  }

  return el(
    "section",
    { class: "screen start" },
    me && whoami(me, { signOut }),
    el("h1", {}, name),
    el("p", { class: "lede" }, "A card game about Git. Ship commits to main; survive push --force."),
    el(
      "form",
      { onsubmit: submit },
      el("label", { for: "bots" }, "bots"),
      bots,
      el("label", { for: "others" }, "others at this device (hotseat), comma-separated"),
      others,
      el("label", { for: "length" }, "day length"),
      length,
      error,
      button,
    ),
  );
}
