import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { name, domain } from "./brand.js";
import { moved } from "./landing.js";

it("sends a link from before the game moved on to /play, and keeps the page's own anchors", () => {
  expect(moved({ hash: "#/room/k7m2x9qa", search: "" })).toBe("/play#/room/k7m2x9qa");
  expect(moved({ hash: "#/g/abc", search: "?utm_source=hn" })).toBe("/play?utm_source=hn#/g/abc");
  expect(moved({ hash: "#faq", search: "" })).toBeNull();
  expect(moved({ hash: "", search: "?utm_source=hn" })).toBeNull();
});

// the landing page as the build fills it in (vite.config.js)
const page = readFileSync(new URL("../index.html", import.meta.url), "utf8")
  .replaceAll("%BRAND%", name)
  .replaceAll("%DOMAIN%", domain);
const meta = (attr, key) => page.match(new RegExp(`<meta\\s+${attr}="${key}"\\s+content="([^"]*)"`))?.[1];

it("the landing page has what search engines and link previews read", () => {
  const title = page.match(/<title>([^<]*)<\/title>/)[1];
  expect(title.length).toBeLessThanOrEqual(60);
  const description = page.match(/name="description"\s+content="([^"]*)"/)[1];
  expect(description.length).toBeGreaterThan(70);
  expect(description.length).toBeLessThanOrEqual(160);
  expect(page).toContain(`<link rel="canonical" href="https://${domain}/" />`);
  expect(meta("property", "og:image")).toBe(`https://${domain}/og.png`);
  expect(meta("property", "og:url")).toBe(`https://${domain}/`);
  expect(meta("name", "twitter:card")).toBe("summary_large_image");
  expect(page.match(/<h1[ >]/g)).toHaveLength(1);
  expect(page).toContain('href="/play"');

  const data = JSON.parse(page.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  expect(data).toMatchObject({ "@type": "VideoGame", name, url: `https://${domain}/` });
});
