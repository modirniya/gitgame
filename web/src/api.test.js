import { describe, expect, it } from "vitest";
import { remote, RemoteError } from "./api.js";

function fake(status, body) {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, init });
    return { ok: status < 400, status, json: async () => body };
  };
  return { calls, api: remote(fetcher) };
}

describe("the remote", () => {
  it("creates a game with its seats, bots and day length", async () => {
    const { calls, api } = fake(201, { id: "g1" });
    await api.createGame({ seats: ["ana", "bot"], bots: ["bot"], dayLength: "lunch" });

    expect(calls[0].url).toBe("/api/games");
    expect(JSON.parse(calls[0].init.body)).toEqual({
      seats: ["ana", "bot"],
      bots: ["bot"],
      day_length: "lunch",
    });
  });

  it("fetches a player's view with the name escaped", async () => {
    const { calls, api } = fake(200, {});
    await api.fetchView("g1", "ana & raj");
    expect(calls[0].url).toBe("/api/games/g1?player=ana%20%26%20raj");
  });

  it("marks a rejected pack as stale, in the remote's own words", async () => {
    const message = " ! [rejected]        main -> main (fetch first)";
    const { api } = fake(409, { error: message });
    const error = await api.sendPack("g1", { player: "ana", version: 2, ops: [] }).catch((e) => e);

    expect(error).toBeInstanceOf(RemoteError);
    expect(error.stale).toBe(true);
    expect(error.message).toBe(message);
  });

  it("says so when the remote can't be reached", async () => {
    const api = remote(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(api.fetchView("g1")).rejects.toThrow(/unable to access the remote/);
  });

  it("watches a game: every signal is a refetch, and the stream closes after the release", () => {
    let source;
    class Source {
      constructor(url) {
        this.url = url;
        this.listeners = {};
        this.closed = false;
        source = this;
      }
      addEventListener(type, f) {
        this.listeners[type] = f;
      }
      close() {
        this.closed = true;
      }
    }

    const signals = [];
    remote(async () => ({})).live("g1", () => signals.push("refetch"), Source);
    expect(source.url).toBe("/api/games/g1/live");

    source.listeners.refetch({ data: '{"over":false}' });
    expect(source.closed).toBe(false);
    source.listeners.refetch({ data: '{"over":true}' });
    expect(signals).toEqual(["refetch", "refetch"]);
    expect(source.closed).toBe(true);
  });
});
