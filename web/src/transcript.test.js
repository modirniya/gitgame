// @vitest-environment jsdom
import { expect, it } from "vitest";
import { transcript } from "./transcript.js";

it("prints each op as a prompt with Git's output under it, and the rest as comments", () => {
  const node = transcript(
    [
      { kind: "pushed", player: "ana", command: "git push", output: ["   16bb9f2..53d8cce  main -> main"], tone: "ok" },
      {
        kind: "forced",
        player: "bot",
        command: "git push --force",
        output: [" + a...b main -> main (forced update)"],
        notes: ["erased 53d8cce"],
        tone: "reject",
      },
      { kind: "empty", player: "raj", command: null, output: ["sent no pack today"], tone: "warn" },
      { kind: "incident", player: null, command: null, output: [], tone: "warn" },
    ],
    "ana",
  );

  expect([...node.children].map((c) => c.textContent)).toEqual([
    "ana@main $ git push   16bb9f2..53d8cce  main -> main",
    "bot@main $ git push --force + a...b main -> main (forced update)# erased 53d8cce",
    "# raj sent no pack today",
  ]);
  expect(node.querySelector(".mine.ok")).not.toBeNull();
});
