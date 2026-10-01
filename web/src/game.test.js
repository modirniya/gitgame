// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { gameScreen } from "./game.js";
import { view } from "./view.fixture.js";

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
