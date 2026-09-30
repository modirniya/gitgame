// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { nudge, whoami } from "./whoami.js";

const anon = { player: { id: "p1", handle: "quiet-otter-42", github: null }, link_github: true };
const linked = {
  player: { id: "p1", handle: "quiet-otter-42", github: { login: "octo", avatar_url: "https://avatars.example/42" } },
  link_github: true,
};

describe("who you are", () => {
  it("an anonymous player sees their handle and a way to link GitHub, and no way to sign out", () => {
    const bar = whoami(anon, { signOut: () => {} });
    expect(bar.querySelector(".handle").textContent).toBe("quiet-otter-42");
    expect(bar.querySelector("a").getAttribute("href")).toBe("/api/auth/github");
    expect(bar.querySelector("button")).toBeNull();
  });

  it("a linked player sees their GitHub login and avatar, and can sign out", () => {
    let out = 0;
    const bar = whoami(linked, { signOut: () => out++ });
    expect(bar.textContent).toContain("@octo");
    expect(bar.querySelector("img").getAttribute("src")).toBe("https://avatars.example/42");
    expect(bar.querySelector("a")).toBeNull();
    bar.querySelector("button").click();
    expect(out).toBe(1);
  });

  it("offers no link on a remote that can't make one", () => {
    expect(whoami({ ...anon, link_github: false }, { signOut: () => {} }).querySelector("a")).toBeNull();
    expect(nudge({ ...anon, link_github: false })).toBeNull();
  });

  it("nudges only a player whose games live in this browser alone", () => {
    expect(nudge(anon).textContent).toContain("only key to quiet-otter-42's games");
    expect(nudge(linked)).toBeNull();
  });
});
