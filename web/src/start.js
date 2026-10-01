// I-Start (event-screens §3): a new game in a few seconds (charter priority 2). One tap plays the bot; another opens a
// room to invite someone (M9). Under "more", a game set up by hand: you take the first seat, as the player this device
// is signed in as (ADR-0005), anyone else at the device can take a seat too (hotseat), and the remote plays the bots.
import { el } from "./dom.js";
import { name } from "./brand.js";
import { whoami } from "./whoami.js";
import { gamesList } from "./games.js";
import { emailSettings } from "./email.js";
import { setGuided } from "./guide.js";

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
  // a notice written as a terminal comment ("# ...") is news, not a failure
  const note = !failure && notice.startsWith("#");
  const error = el("p", { class: note ? "muted" : "error", role: "alert" }, failure?.message ?? notice);
  const button = el("button", { class: "primary", type: "submit", disabled: !me }, "git init");

  // Five-minute days: a first game against the bot shouldn't mark someone absent for reading the screens slowly.
  // A player's first game is guided (M14d): nothing else they've played to learn from yet. The remote deals it so that
  // their first push lands (M15h).
  const quick = () =>
    busy(async () => {
      const first = (await remote.listGames().catch(() => [null])).length === 0;
      const view = await remote.createGame({ bots: ["bot"], dayLength: "lunch", guided: first });
      if (first) setGuided(view.id, true);
      go(`/g/${view.id}`);
    });
  const invite = () => busy(() => remote.openRoom().then((room) => go(`/room/${room.code}`)));

  async function busy(f) {
    error.textContent = "";
    for (const b of [play, room, button]) b.disabled = true;
    try {
      await f();
    } catch (e) {
      error.textContent = e.message;
      for (const b of [play, room, button]) b.disabled = !me;
    }
  }

  // your games arrive after the screen: a slow list never holds up "play the bot now"
  const yours = el("div", {});
  if (me)
    remote.listGames().then(
      (games) => yours.replaceChildren(gamesList(games) ?? ""),
      () => {},
    );

  const play = el("button", { class: "primary", disabled: !me, onclick: quick }, "play the bot now");
  const room = el("button", { disabled: !me, onclick: invite }, "invite someone");

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
    el("div", { class: "start-actions" }, play, room),
    error,
    yours,
    me && emailSettings(remote),
    el("details", { class: "more" }, el("summary", {}, "more: set up a game by hand"), form()),
  );

  function form() {
    return el(
      "form",
      { onsubmit: submit },
      el("label", { for: "bots" }, "bots"),
      bots,
      el("label", { for: "others" }, "others at this device (hotseat), comma-separated"),
      others,
      el("label", { for: "length" }, "day length"),
      length,
      button,
    );
  }
}
