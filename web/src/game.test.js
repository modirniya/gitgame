// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { gameScreen } from "./game.js";
import { view } from "./view.fixture.js";
import game from "./game.fixture.json";

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

it("warns before sending a pack that leaves ops unspent, and sends it on the second tap", async () => {
  const sendPack = vi.fn(async () => ({}));
  const remote = { fetchView: async () => view(), live: () => () => {}, sendPack };
  const screen = gameScreen({ remote, go: () => {}, id: "g1" });
  await settle();
  const send = () => screen.node.querySelector(".send");

  // an empty pack: all three of the day's ops unspent
  send().click();
  await settle();
  expect(sendPack).not.toHaveBeenCalled();
  expect(screen.node.querySelector(".unspent").textContent).toBe(
    "# 3 of today's 3 ops unspent: you could still add, pull, push --force",
  );
  expect(send().textContent).toBe("send anyway");

  send().click();
  await settle();
  expect(sendPack).toHaveBeenCalledOnce();
  screen.leave();
});

it("ends a game on the scoreboard, with a box for a note to the maintainer", async () => {
  const over = view({ released: { day: 12, bugs: 0, production_down: false } });
  const remote = {
    fetchView: async () => over,
    live: () => () => {},
    feedback: async () => ({ body: null, max: 1000 }),
  };
  const screen = gameScreen({ remote, go: () => {}, id: "g1" });
  await settle();
  expect(screen.node.querySelector(".scoreboard h1").textContent).toBe("The release shipped.");
  expect(screen.node.querySelector(".scoreboard .scores th.you").textContent).toBe("you");
  expect(screen.node.querySelector(".scoreboard form.feedback textarea")).not.toBeNull();
  screen.leave();
});

it("shows a finished game's scoreboard to someone who held no seat in it", async () => {
  // the table's view: what anyone may see, with no seat of theirs in it
  const over = view({ released: { day: 12, bugs: 0, production_down: false }, you: null, yours: null });
  const remote = { fetchView: async () => over, live: () => () => {} };
  const screen = gameScreen({ remote, go: () => {}, id: "g1" });
  await settle();
  expect(screen.node.querySelector(".scoreboard h1").textContent).toBe("The release shipped.");
  expect(screen.node.querySelectorAll(".scoreboard .scores .you")).toHaveLength(0);
  // nor a feedback box: a note is for those who played
  expect(screen.node.querySelector(".feedback")).toBeNull();
  screen.leave();
});

it("keeps a log of every day in the Table, newest first", async () => {
  // this reader has read every day already: nothing plays back, the hub is up
  localStorage.setItem("gitgame:g1:ana", JSON.stringify({ logs: 3, opened: 4 }));
  const v = view({ day: 4, days: game.days.slice(0, 3), main: game.main, today: [] });
  const remote = { fetchView: async () => v, live: () => () => {} };
  const screen = gameScreen({ remote, go: () => {}, id: "g1" });
  await settle();
  expect(screen.node.querySelector(".view.hub")).not.toBeNull();
  expect([...screen.node.querySelectorAll(".table-panel .log h3")].map((h) => h.textContent)).toEqual([
    "day 3",
    "day 2",
    "day 1",
  ]);
  screen.leave();
  localStorage.clear();
});
