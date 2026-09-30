// The remote's JSON API (server/lib/gitgame_web/router.ex), and nothing else: every call is a fetch, every answer is
// the view as the server sends it. There is no client-side game state to reconnect (charter decision 9), so any error
// is a message to show and, when the pack was stale, a reason to fetch again.

/** An answer from the remote that wasn't a success. `message` is the remote's own words, usually Git's. */
export class RemoteError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    // 409 after a pack: the day moved on while it was being written (`! [rejected] ... (fetch first)`)
    this.stale = status === 409;
  }
}

async function call(fetcher, path, init) {
  let response;
  try {
    response = await fetcher(`/api${path}`, {
      ...init,
      headers: { accept: "application/json", "content-type": "application/json" },
    });
  } catch {
    throw new RemoteError(0, "fatal: unable to access the remote: could not connect to server");
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new RemoteError(response.status, body.error || `fatal: ${response.status}`);
  return body;
}

function watch(url, signal, Source = globalThis.EventSource) {
  if (!Source) return () => {};
  const source = new Source(url);
  source.addEventListener("refetch", (e) => {
    signal();
    if (JSON.parse(e.data).over) source.close();
  });
  return () => source.close();
}

export function remote(fetcher = globalThis.fetch.bind(globalThis)) {
  return {
    /**
     * Who this device is signed in as, `{player, link_github}`, or null. The session is an HttpOnly cookie the page never
     * sees (ADR-0005); `link_github` says whether this remote can link a GitHub account.
     */
    me: (via) =>
      call(fetcher, via ? `/session?via=${encodeURIComponent(via)}` : "/session").catch((e) => {
        if (e.status === 401) return null;
        throw e;
      }),

    /** Sign this device in as a new anonymous player; a device already signed in gets its own player back. */
    join: () => call(fetcher, "/players", { method: "POST" }),

    /** Sign this device out. */
    signOut: () => call(fetcher, "/session", { method: "DELETE" }),

    /**
     * A new game: you take the first seat, `hotseat` names the other people at this device, and the remote plays the
     * `bots`. The answer is the game from your seat.
     */
    createGame: ({ hotseat = [], bots = [], dayLength = "live", seed }) =>
      call(fetcher, "/games", {
        method: "POST",
        body: JSON.stringify({ hotseat, bots, day_length: dayLength, ...(seed != null && { seed }) }),
      }),

    /** Your games (M9c): every game this device's player holds a seat in, those waiting on their pack first. */
    listGames: () => call(fetcher, "/games").then((r) => r.games),

    /** The game from a seat this device holds (`seat`, or its first), or the table's view if it holds none. */
    fetchView: (id, seat) =>
      call(fetcher, `/games/${encodeURIComponent(id)}${seat ? `?seat=${encodeURIComponent(seat)}` : ""}`),

    /** A replay: the view as it stood when `day` closed (0: as created), folded by the remote from the log. */
    fetchDay: (id, day, seat) =>
      call(fetcher, `/games/${encodeURIComponent(id)}/days/${day}${seat ? `?seat=${encodeURIComponent(seat)}` : ""}`),

    /**
     * Watch a game: `signal()` runs whenever the remote says to refetch, which it does on connecting and after every
     * write; the stream closes itself after the release. The browser's EventSource reconnects on its own, and a
     * reconnect is just one more refetch. Returns a function that stops watching.
     */
    live: (id, signal, Source) => watch(`/api/games/${encodeURIComponent(id)}/live`, signal, Source),

    /** Rooms (M9): open one, look at it, join it, set it up (host), start its game (host). Each answers with the room. */
    openRoom: () => call(fetcher, "/rooms", { method: "POST" }),
    fetchRoom: (code) => call(fetcher, `/rooms/${encodeURIComponent(code)}`),
    joinRoom: (code) => call(fetcher, `/rooms/${encodeURIComponent(code)}/join`, { method: "POST" }),
    updateRoom: (code, { bots, dayLength }) =>
      call(fetcher, `/rooms/${encodeURIComponent(code)}`, {
        method: "PATCH",
        body: JSON.stringify({ bots, day_length: dayLength }),
      }),
    startRoom: (code) => call(fetcher, `/rooms/${encodeURIComponent(code)}/start`, { method: "POST" }),
    /** Watch a room, as `live` watches a game; its stream closes once the game has started. */
    liveRoom: (code, signal, Source) => watch(`/api/rooms/${encodeURIComponent(code)}/live`, signal, Source),

    /** Send, or replace, today's pack for `seat`. `version` is the one the pack was written against. */
    sendPack: (id, { seat, version, ops, discard = [] }) =>
      call(fetcher, `/games/${encodeURIComponent(id)}/packs`, {
        method: "POST",
        body: JSON.stringify({ seat, version, ops, discard }),
      }),
  };
}
