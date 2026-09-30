// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { roomLink, roomScreen } from "./room.js";

const room = (over = {}) => ({
  code: "k7m2x9qa",
  host: "quiet-otter-42",
  members: [{ id: "p1", handle: "quiet-otter-42", github: null }],
  bots: 0,
  day_length: "live",
  seats: 5,
  game_id: null,
  you: { member: true, host: true },
  ...over,
});

// A remote that answers with `answers` in turn, and records what the screen asked it.
function fakeRemote(...answers) {
  const calls = [];
  const next = () => Promise.resolve(answers.length > 1 ? answers.shift() : answers[0]);
  const record =
    (name) =>
    (...args) => (calls.push([name, ...args]), next());
  return {
    calls,
    fetchRoom: record("fetchRoom"),
    joinRoom: record("joinRoom"),
    updateRoom: record("updateRoom"),
    startRoom: record("startRoom"),
    liveRoom: () => () => {},
  };
}

const settle = () => new Promise((r) => setTimeout(r));

describe("a room", () => {
  it("shows its host the link to share, and a start that waits for a second seat", async () => {
    const screen = roomScreen({ remote: fakeRemote(room()), go: () => {}, code: "k7m2x9qa" });
    await settle();

    expect(screen.node.querySelector(".share code").textContent).toBe(roomLink("k7m2x9qa"));
    const start = screen.node.querySelector("form button");
    expect(start.disabled).toBe(true);
    expect(start.textContent).toBe("waiting for a second seat");
  });

  it("lets its host add a bot, then start", async () => {
    const remote = fakeRemote(room(), room({ bots: 1 }));
    const screen = roomScreen({ remote, go: () => {}, code: "k7m2x9qa" });
    await settle();

    const bots = screen.node.querySelector("#room-bots");
    bots.value = "1";
    bots.dispatchEvent(new Event("change"));
    await settle();
    expect(remote.calls.at(-1)).toEqual(["updateRoom", "k7m2x9qa", { bots: 1, dayLength: "live" }]);

    screen.node.querySelector("form").dispatchEvent(new Event("submit"));
    await settle();
    expect(remote.calls.at(-1)).toEqual(["startRoom", "k7m2x9qa"]);
  });

  it("offers someone who opened the link a way in", async () => {
    const visitor = room({ you: { member: false, host: false } });
    const remote = fakeRemote(visitor);
    const screen = roomScreen({ remote, go: () => {}, code: "k7m2x9qa" });
    await settle();

    expect(screen.node.querySelector("form")).toBeNull();
    [...screen.node.querySelectorAll("button")].find((b) => b.textContent === "join").click();
    await settle();
    expect(remote.calls.at(-1)).toEqual(["joinRoom", "k7m2x9qa"]);
  });

  it("takes its members to their seat when the game starts", async () => {
    const went = [];
    roomScreen({ remote: fakeRemote(room({ game_id: "g1" })), go: (p) => went.push(p), code: "k7m2x9qa" });
    await settle();
    expect(went).toEqual(["/g/g1"]);
  });
});
