// @vitest-environment jsdom
import { expect, it } from "vitest";
import { card } from "./cards.js";

it("keeps a command's flag in one piece where its name wraps", () => {
  const name = card({ id: "k", kind: "command", command: "force" }).querySelector(".name");
  expect(name.textContent).toBe("push --force");
  expect([...name.querySelectorAll(".flag")].map((f) => f.textContent)).toEqual(["--force"]);
  // a name with no flag may still wrap at its hyphen
  expect(card({ id: "k", kind: "command", command: "cherry_pick" }).querySelector(".flag")).toBeNull();
});
