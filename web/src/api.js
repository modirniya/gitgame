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

export function remote(fetcher = globalThis.fetch.bind(globalThis)) {
  return {
    /** A new game. `bots` are seats the remote plays; the answer is the public view. */
    createGame: ({ seats, bots = [], dayLength = "live", seed }) =>
      call(fetcher, "/games", {
        method: "POST",
        body: JSON.stringify({ seats, bots, day_length: dayLength, ...(seed != null && { seed }) }),
      }),

    /** The view as `player` sees it, or the public view if `player` is omitted. */
    fetchView: (id, player) =>
      call(fetcher, `/games/${encodeURIComponent(id)}${player ? `?player=${encodeURIComponent(player)}` : ""}`),

    /** Send, or replace, today's pack. `version` is the one the pack was written against. */
    sendPack: (id, { player, version, ops, discard = [] }) =>
      call(fetcher, `/games/${encodeURIComponent(id)}/packs`, {
        method: "POST",
        body: JSON.stringify({ player, version, ops, discard }),
      }),
  };
}
