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

  it("labels each commit with what was announced, and marks the tip", () => {
    const slots = [...node.querySelectorAll(".strip .slot")];
    expect(slots.map((s) => s.querySelector(".who").textContent)).toEqual([
      "",
      "you Dockerfile +7",
      "bot README.md +4",
    ]);
    expect(slots.map((s) => s.querySelector(".tipmark").textContent)).toEqual(["", "", "tip"]);
    expect(node.querySelector(".strip-head").textContent).toBe("main2/10 commits");
  });

  it("puts each pointer under the commit that seat is at", () => {
    const chips = [...node.querySelectorAll(".strip li")].map((li) => li.querySelector(".pointers").textContent);
    // your own pointer reads "you", as everywhere else on your screen
    expect(chips).toEqual(["", "you", "bot"]);
  });

  it("shows another player's commit message as text, never as markup", () => {
    expect(node.querySelector(".strip b")).toBeNull();
    expect(node.querySelector('[data-id="15efd4d"]').title).toBe("docs: <b>badge</b>");
  });

  it("gives every seat its score, counts and whether its pack is in", () => {
    const seats = [...node.querySelectorAll(".seat")].map((s) => s.textContent);
    expect(seats[0]).toContain("7");
    expect(seats[0]).toContain("1 behind");
    expect(seats[0]).toContain("writing…");
    expect(seats[1]).toContain("blame ×3");
    expect(seats[1]).toContain("pack sent");
  });

  it("shows whose pack is in only on a day still open, not in a replay or a finished game", () => {
    const past = table(view({ deadline: null }));
    expect(past.textContent).not.toMatch(/writing…|pack sent/);
  });
});
