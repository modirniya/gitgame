// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { table } from "./table.js";
import { view } from "./view.fixture.js";

describe("the table", () => {
  const node = table(view());

  it("shows main from the initial commit to the tip, face-down until flipped", () => {
    const cards = [...node.querySelectorAll(".strip .card")];
    expect(cards.map((c) => c.dataset.id)).toEqual([undefined, "53d8cce", "15efd4d"]);
    expect(cards[1].classList.contains("down")).toBe(true);
    expect(cards[2].classList.contains("bug")).toBe(true);
    expect(cards[2].classList.contains("tip")).toBe(true);
  });

  it("puts each pointer under the commit that seat is at", () => {
    const chips = [...node.querySelectorAll(".strip li")].map((li) => li.querySelector(".pointers").textContent);
    expect(chips).toEqual(["", "ana", "bot"]);
  });

  it("shows another player's commit message as text, never as markup", () => {
    expect(node.querySelector("b")).toBeNull();
    expect(node.querySelector('[data-id="15efd4d"]').title).toBe("docs: <b>badge</b>");
  });

  it("gives every seat its score, counts and whether its pack is in", () => {
    const seats = [...node.querySelectorAll(".seat")].map((s) => s.textContent);
    expect(seats[0]).toContain("7");
    expect(seats[0]).toContain("1 behind");
    expect(seats[0]).toContain("writing…");
    expect(seats[1]).toContain("3 blame");
    expect(seats[1]).toContain("pack sent");
  });
});
