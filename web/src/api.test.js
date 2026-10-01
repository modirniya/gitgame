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

  it("asks for a hint from a seat, as the seat this device holds", async () => {
    const { calls, api } = fake(200, { ops: [{ op: "pull" }] });
    expect(await api.hint("g1", "raj")).toEqual({ ops: [{ op: "pull" }] });
    expect(calls[0].url).toBe("/api/games/g1/hint?seat=raj");
  });

  it("asks for a guided game only when it is one", async () => {
    const { calls, api } = fake(201, { id: "g1" });
    await api.createGame({ bots: ["bot"], dayLength: "lunch", guided: true });
    await api.createGame({ bots: ["bot"], dayLength: "lunch", guided: false });

    expect(JSON.parse(calls[0].init.body)).toEqual({ hotseat: [], bots: ["bot"], day_length: "lunch", guided: true });
    expect(JSON.parse(calls[1].init.body)).not.toHaveProperty("guided");
  });

  it("fetches the view from a seat, the name escaped, or from the device's own seat", async () => {
    const { calls, api } = fake(200, {});
    await api.fetchView("g1", "ana & raj");
    await api.fetchView("g1");
    expect(calls.map((c) => c.url)).toEqual(["/api/games/g1?seat=ana%20%26%20raj", "/api/games/g1"]);
  });

  it("knows who this device is, or that it is nobody yet, signs it in, and out", async () => {
    const me = { player: { id: "p1", handle: "quiet-otter-42", github: null }, link_github: false };
    expect(await fake(200, me).api.me()).toEqual(me);
    expect(await fake(401, { error: "fatal: not signed in" }).api.me()).toBeNull();

    const from = fake(200, me);
    await from.api.me("notification");
    expect(from.calls[0].url).toBe("/api/session?via=notification");

    const { calls, api } = fake(201, me);
    expect(await api.join()).toEqual(me);
    await api.signOut();
    expect(calls.map((c) => [c.url, c.init.method])).toEqual([
      ["/api/players", "POST"],
      ["/api/session", "DELETE"],
    ]);
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
