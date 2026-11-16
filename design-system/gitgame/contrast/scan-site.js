// The whole site, checked as people see it (MASTER.md §7). Visits every page, then plays a real game against the bot
// on the running app (web on :5173, the remote on :4000, STATS_TOKEN=devtoken): start, the hub with a card picked,
// the table sheet, a day played back, its receipt, the release and scoreboard, a replay, a room and /stats. At each
// screen, in dark and light, it checks every visible text node's contrast against its real background, readable text
// under 12 px, controls under 44 px (links 24 px), and sideways page scroll; optionally it saves a screenshot.
//
//   node scan-site.js [--width 375] [--shots <dir>] [--only pages|game]
//
// Exits 1 if anything is found. Run it from anywhere: it needs only `playwright`.
const { chromium } = require("playwright");

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const WIDTH = Number(arg("width", "375"));
const SHOTS = arg("shots", null);
const ONLY = arg("only", null);
const BASE = "http://localhost:5173";
const PAGES = [
  "",
  "git",
  "git/non-fast-forward",
  "git/forced-update",
  "git/conflict",
  "git/already-up-to-date",
  "git/fast-forward",
  "git/force-pushed-over-me",
  "git/push-rejected",
  "git/lost-commit",
  "git/who-broke-main",
  "git/undo-on-main",
  "teach",
  "teams",
  "new-to-git",
  "privacy",
  "terms",
];

// runs in the page: every finding on the screen as it stands
function inspect() {
  const found = [];
  const parse = (c) => (c.match(/[\d.]+/g) || []).map(Number);
  const lum = (rgb) =>
    rgb
      .slice(0, 3)
      .map((v) => ((v /= 255), v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const shown = (el) => {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) return false;
      if (e.parentElement?.tagName === "DETAILS" && !e.parentElement.open && e.tagName !== "SUMMARY") return false;
    }
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  // the opaque color behind an element, compositing translucent layers; null over an image or gradient
  const behind = (el) => {
    const layers = [];
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage !== "none") return null;
      const c = parse(cs.backgroundColor);
      if (c.length >= 3 && (c[3] ?? 1) > 0) {
        layers.push(c);
        if ((c[3] ?? 1) >= 1) break;
      }
    }
    let out = [255, 255, 255];
    for (const c of layers.reverse()) {
      const a = c[3] ?? 1;
      out = out.map((v, i) => c[i] * a + v * (1 - a));
    }
    return out;
  };
  const opacityOf = (el) => {
    let o = 1;
    for (let e = el; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity);
    return o;
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = walker.nextNode());) {
    const el = n.parentElement;
    const text = n.textContent.trim();
    if (!text || !shown(el) || el.closest("svg, script, style, .visually-hidden, [aria-hidden=true]")) continue;
    const cs = getComputedStyle(el);
    const size = parseFloat(cs.fontSize);
    if (size < 11.5) found.push(`text ${size.toFixed(1)}px "${text.slice(0, 32)}"`);
    if (el.closest(":disabled, [aria-disabled=true]")) continue; // WCAG 1.4.3 exempts inactive controls
    const bg = behind(el);
    if (!bg) continue;
    const fg = parse(cs.color);
    const a = (fg[3] ?? 1) * opacityOf(el);
    const mixed = fg.slice(0, 3).map((v, i) => v * a + bg[i] * (1 - a));
    const [hi, lo] = [lum(mixed), lum(bg)].sort((x, y) => y - x);
    const ratio = (hi + 0.05) / (lo + 0.05);
    const need = size >= 24 || (Number(cs.fontWeight) >= 700 && size >= 18.66) ? 3 : 4.5;
    if (ratio < need) found.push(`contrast ${ratio.toFixed(2)} < ${need} "${text.slice(0, 32)}"`);
  }
  for (const el of document.querySelectorAll(
    "button, summary, input:not([type=checkbox]):not([type=hidden]), select, a",
  )) {
    if (!shown(el)) continue;
    const r = el.getBoundingClientRect();
    const label = (el.getAttribute("aria-label") || el.textContent || el.value || "").trim().slice(0, 28);
    if (el.tagName === "A") {
      const inProse = getComputedStyle(el).display === "inline";
      if (!inProse && r.height < 23.5) found.push(`target ${Math.round(r.width)}×${Math.round(r.height)} a "${label}"`);
    } else if (r.height < 43.5 || r.width < 43.5)
      found.push(`target ${Math.round(r.width)}×${Math.round(r.height)} ${el.tagName.toLowerCase()} "${label}"`);
  }
  if (document.documentElement.scrollWidth > innerWidth + 1)
    found.push(`page scrolls sideways: ${document.documentElement.scrollWidth}px`);
  return found;
}

(async () => {
  const browser = await chromium.launch();
  let total = 0;
  for (const scheme of ["dark", "light"]) {
    const ctx = await browser.newContext({
      viewport: { width: WIDTH, height: 860 },
      colorScheme: scheme,
      reducedMotion: "reduce",
      httpCredentials: { username: "x", password: "devtoken" },
    });
    const page = await ctx.newPage();
    const check = async (name) => {
      await page.waitForTimeout(500);
      const found = [...new Set(await page.evaluate(inspect))];
      total += found.length;
      console.log(`${scheme} ${WIDTH}px ${name}: ${found.length}`);
      for (const f of found.slice(0, 12)) console.log(`    ${f}`);
      if (SHOTS)
        await page.screenshot({
          path: `${SHOTS}/${name.replaceAll("/", "_") || "landing"}-${WIDTH}-${scheme}.png`,
          fullPage: true,
        });
    };
    const api = (path, init) =>
      page.evaluate(
        async ([p, i]) => {
          const r = await fetch(`/api${p}`, i ? { ...i, headers: { "content-type": "application/json" } } : undefined);
          return { status: r.status, body: await r.json().catch(() => null) };
        },
        [path, init],
      );
    const sendHint = async (id) => {
      const v = (await api(`/games/${id}`)).body;
      if (v.released) return false;
      const hint = (await api(`/games/${id}/hint`)).body;
      await api(`/games/${id}/packs`, {
        method: "POST",
        body: JSON.stringify({ version: v.version, ops: hint?.ops ?? [], discard: [] }),
      });
      await page.waitForTimeout(400);
      return true;
    };
    const tap = async (name) => {
      const b = page.getByRole("button", { name }).first();
      if (await b.count()) await b.click();
      return b.count();
    };

    if (ONLY !== "game")
      for (const p of PAGES) {
        await page.goto(`${BASE}/${p}`, { waitUntil: "networkidle" });
        await check(p || "landing");
      }
    if (ONLY !== "pages") {
      await page.goto(`${BASE}/stats`, { waitUntil: "networkidle" });
      await check("stats");
      await page.goto(`${BASE}/play`, { waitUntil: "networkidle" });
      await check("start");
      await tap("play the bot now");
      await page.waitForURL(/#\/g\//);
      const id = page.url().split("#/g/")[1].split("/")[0];
      await check("incident");
      await tap(/write your pack/i);
      await page.locator(".hand-rows .card").first().click();
      await check("hub");
      if (await tap(/^table$/)) {
        await check("table");
        await page.keyboard.press("Escape");
      }
      await sendHint(id);
      await page.reload({ waitUntil: "networkidle" });
      await check("playback");
      await tap(/skip/i);
      await check("receipt");
      while (await sendHint(id));
      await page.reload({ waitUntil: "networkidle" });
      for (let i = 0; i < 80 && !(await page.locator(".feedback").count()); i++) {
        if (!(await tap(/skip to the day/i)) && !(await tap(/^continue$/i))) break;
        await page.waitForTimeout(120);
      }
      await check("release");
      await page.goto(`${BASE}/play#/r/${id}/2`, { waitUntil: "networkidle" });
      await check("replay");
      await page.goto(`${BASE}/play#/`, { waitUntil: "networkidle" });
      await check("start-with-games");
      await tap("invite someone");
      await page.waitForURL(/#\/room\//);
      await check("room");
    }
    await ctx.close();
  }
  await browser.close();
  console.log(`total findings: ${total}`);
  process.exitCode = total ? 1 : 0;
})();
