// I-Start (event-screens §3): a new game in a few seconds (charter priority 2). Hotseat until sign-in exists (M8):
// the people at this device take the human seats and pass it between them; the remote plays the bots.
import { el } from "./dom.js";
import { name } from "./brand.js";

const LENGTHS = [
  ["live", "live · 60s days"],
  ["lunch", "lunch · 5m days"],
  ["correspondence", "correspondence · 24h days"],
];

/** The seats a form's answers make: people first, in the order typed, then `bots` bots. */
export function seatsFrom(people, bots) {
  const humans = people
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const robots = Array.from({ length: bots }, (_, i) => (bots === 1 ? "bot" : `bot-${i + 1}`));
  const seats = [...humans, ...robots];

  if (humans.length === 0) return { error: "fatal: a game needs at least one person" };
  if (seats.length < 2 || seats.length > 5) return { error: "fatal: a game has 2 to 5 seats" };
  if (new Set(seats).size !== seats.length) return { error: "fatal: every seat needs its own name" };
  return { seats, humans, bots: robots };
}

export function startScreen({ remote, go }) {
  const people = el("input", { id: "people", value: "you", autocomplete: "off", spellcheck: "false" });
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
  const error = el("p", { class: "error", role: "alert" });
  const button = el("button", { class: "primary", type: "submit" }, "git init");

  async function submit(event) {
    event.preventDefault();
    const answer = seatsFrom(people.value, Number(bots.value));
    if (answer.error) return (error.textContent = answer.error);

    button.disabled = true;
    error.textContent = "";
    try {
      const view = await remote.createGame({
        seats: answer.seats,
        bots: answer.bots,
        dayLength: length.value,
      });
      go(`/g/${view.id}/${encodeURIComponent(answer.humans[0])}`);
    } catch (e) {
      error.textContent = e.message;
      button.disabled = false;
    }
  }

  return el(
    "section",
    { class: "screen start" },
    el("h1", {}, name),
    el("p", { class: "lede" }, "A card game about Git. Ship commits to main; survive push --force."),
    el(
      "form",
      { onsubmit: submit },
      el("label", { for: "people" }, "people at this device, comma-separated"),
      people,
      el("label", { for: "bots" }, "bots"),
      bots,
      el("label", { for: "length" }, "day length"),
      length,
      error,
      button,
    ),
  );
}
