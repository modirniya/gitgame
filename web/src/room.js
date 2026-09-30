// A room (M9): where a private game is gathered. Its address is the link to share; whoever opens it can join, the host
// sets the bots and the day length and starts the game, and the room's stream brings everyone to the game when it
// does. Like a game, the room is fetched again whenever the remote says it changed (charter decision 9).
import { el, mount } from "./dom.js";

const LENGTHS = { live: "live · 60s days", lunch: "lunch · 5m days", correspondence: "correspondence · 24h days" };

/** The link to this room, as someone else would open it. */
export const roomLink = (code, origin = location.origin) => `${origin}/#/room/${code}`;

export function roomScreen({ remote, go, code }) {
  const node = el("section", { class: "screen room" });
  let alive = true;
  let error = "";

  async function act(f) {
    try {
      error = "";
      show(await f());
    } catch (e) {
      error = e.message;
      refetch();
    }
  }

  function refetch() {
    remote.fetchRoom(code).then(show, (e) => {
      error = e.message;
      alive && mount(node, el("p", { class: "error", role: "alert" }, error), el("a", { href: "#/" }, "home"));
    });
  }

  function show(room) {
    if (!alive) return;
    // started: members go to their seat; anyone else can watch the table
    if (room.game_id && room.you.member) return go(`/g/${room.game_id}`);

    const seats = room.members.length + room.bots;
    const link = roomLink(room.code);

    mount(
      node,
      el("h1", {}, `room ${room.code}`),
      room.game_id
        ? el("p", {}, "This room's game has started. ", el("a", { href: `#/g/${room.game_id}` }, "watch the table"))
        : el(
            "p",
            { class: "share" },
            "Send this link to whoever you're playing: ",
            el("code", {}, link),
            " ",
            navigator.clipboard &&
              el("button", { class: "link", onclick: () => navigator.clipboard.writeText(link) }, "copy"),
          ),
      el(
        "ol",
        { class: "seats" },
        room.members.map((m) =>
          el(
            "li",
            { class: "seat" },
            el("span", { class: "who" }, m.handle),
            el("span", { class: "facts" }, m.handle === room.host ? "host" : m.github ? `@${m.github.login}` : ""),
          ),
        ),
        room.bots > 0 &&
          el("li", { class: "seat" }, el("span", { class: "who" }, `${room.bots} bot${room.bots > 1 ? "s" : ""}`)),
      ),
      el("p", { class: "muted" }, `${seats} of ${room.seats} seats · ${LENGTHS[room.day_length] ?? room.day_length}`),
      !room.game_id &&
        !room.you.member &&
        el("button", { class: "primary", onclick: () => act(() => remote.joinRoom(code)) }, "join"),
      !room.game_id && room.you.host && setup(room, seats),
      !room.game_id &&
        room.you.member &&
        !room.you.host &&
        el("p", { class: "muted" }, `# waiting for ${room.host} to start`),
      el("p", { class: "error", role: "alert" }, error),
      el("p", {}, el("a", { href: "#/" }, "home")),
    );
  }

  // the host's controls: how many bots, how long a day, and the start
  function setup(room, seats) {
    const bots = el(
      "select",
      {
        id: "room-bots",
        onchange: (e) =>
          act(() => remote.updateRoom(code, { bots: Number(e.target.value), dayLength: room.day_length })),
      },
      Array.from({ length: room.seats - room.members.length + 1 }, (_, n) =>
        el("option", { value: n, selected: n === room.bots }, n),
      ),
    );
    const length = el(
      "select",
      {
        id: "room-length",
        onchange: (e) => act(() => remote.updateRoom(code, { bots: room.bots, dayLength: e.target.value })),
      },
      Object.entries(LENGTHS).map(([v, label]) => el("option", { value: v, selected: v === room.day_length }, label)),
    );

    return el(
      "form",
      { onsubmit: (e) => (e.preventDefault(), act(() => remote.startRoom(code))) },
      el("label", { for: "room-bots" }, "bots"),
      bots,
      el("label", { for: "room-length" }, "day length"),
      length,
      el(
        "button",
        { class: "primary", type: "submit", disabled: seats < 2 },
        seats < 2 ? "waiting for a second seat" : "start the game",
      ),
    );
  }

  mount(node, el("p", { class: "muted" }, "$ git fetch"));
  refetch();
  const stop = remote.liveRoom(code, refetch);

  return {
    node,
    leave: () => {
      alive = false;
      stop();
    },
  };
}
