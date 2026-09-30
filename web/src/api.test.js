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
  it("creates a game with the others at this device, the bots and the day length", async () => {
    const { calls, api } = fake(201, { id: "g1" });
    await api.createGame({ hotseat: ["raj"], bots: ["bot"], dayLength: "lunch" });

    expect(calls[0].url).toBe("/api/games");
    expect(JSON.parse(calls[0].init.body)).toEqual({ hotseat: ["raj"], bots: ["bot"], day_length: "lunch" });
  });

  it("fetches the view from a seat, the name escaped, or from the device's own seat", async () => {
    const { calls, api } = fake(200, {});
    await api.fetchView("g1", "ana & raj");
    await api.fetchView("g1");
    expect(calls.map((c) => c.url)).toEqual(["/api/games/g1?seat=ana%20%26%20raj", "/api/games/g1"]);
  });

  it("knows who this device is, or that it is nobody yet, and signs it in", async () => {
    const me = { id: "p1", handle: "quiet-otter-42", github: null };
    expect(await fake(200, { player: me }).api.me()).toEqual(me);
    expect(await fake(401, { error: "fatal: not signed in" }).api.me()).toBeNull();

    const { calls, api } = fake(201, { player: me });
    expect(await api.join()).toEqual(me);
    expect(calls[0]).toMatchObject({ url: "/api/players", init: { method: "POST" } });
  });

  it("marks a rejected pack as stale, in the remote's own words", async () => {
    const message = " ! [rejected]        main -> main (fetch first)";
    const { api } = fake(409, { error: message });
    const error = await api.sendPack("g1", { seat: "ana", version: 2, ops: [] }).catch((e) => e);

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
