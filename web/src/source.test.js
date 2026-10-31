// @vitest-environment jsdom
import { expect, it } from "vitest";
import pkg from "../package.json" with { type: "json" };
import { footLinks, legalFoot, sourceHref } from "./source.js";

it("links the source of the tag this version is deployed from, the privacy policy and the terms", () => {
  expect(sourceHref).toBe(`https://github.com/modirniya/gitgame/tree/v${pkg.version}`);
  const foot = legalFoot();
  expect([...foot.querySelectorAll("a")].map((a) => a.getAttribute("href"))).toEqual([
    sourceHref,
    "/privacy",
    "/terms",
  ]);
  expect(foot.textContent).toBe(`source of v${pkg.version} (AGPL-3.0) · privacy · terms`);
  expect(footLinks).toHaveLength(3);
});
