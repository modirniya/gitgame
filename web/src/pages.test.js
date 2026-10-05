import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pages } from "./pages.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe.each(pages)("the page at /$path", ({ path, title }) => {
  const html = read(`${path}/index.html`);

  it("has what a search result reads, its own address as canonical, and a way into the game", () => {
    expect(html).toContain(`<title>${title} · %BRAND%</title>`);
    const description = html.match(/name="description"\s+content="([^"]*)"/)[1];
    expect(description.length).toBeGreaterThan(70);
    expect(description.length).toBeLessThanOrEqual(160);
    expect(html).toContain(`<link rel="canonical" href="https://%DOMAIN%/${path}" />`);
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(html).toContain('href="/play"');
  });

  it("quotes only what scripts/git-output.sh captured, and names the Git that printed it", () => {
    const quoted = [...html.matchAll(/%CAPTURE:([a-z0-9-]+)%/g)].map((m) => m[1]);
    for (const scenario of quoted) expect(read(`captures/${scenario}.txt`)).toMatch(/^# git version /);
    if (quoted.length) expect(html).toContain("Git %GIT_VERSION%");
  });
});

it("the door at /git links every page under it", () => {
  const door = read("git/index.html");
  for (const { path } of pages) if (path.startsWith("git/")) expect(door).toContain(`href="/${path}"`);
});
