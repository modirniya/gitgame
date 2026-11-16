// Automated contrast scan: every visible text node's computed colour against its effective (opaque) background,
// in light and dark. Usage: node scan-contrast.js <url> [width]
const { chromium } = require("playwright");
const [url, width = "1280"] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  let total = 0;
  for (const scheme of ["dark", "light"]) {
    const ctx = await b.newContext({
      viewport: { width: +width, height: 900 },
      colorScheme: scheme,
    });
    const p = await ctx.newPage();
    await p.goto(url, { waitUntil: "networkidle" });
    const bad = await p.evaluate(() => {
      const parse = (c) => (c.match(/[\d.]+/g) || []).map(Number);
      const lum = ([r, g, b]) =>
        [r, g, b]
          .map((v) => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          })
          .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
      const bgOf = (el) => {
        for (let e = el; e; e = e.parentElement) {
          const cs = getComputedStyle(e);
          if (cs.backgroundImage !== "none" && !cs.backgroundImage.startsWith("url")) return null; // gradients: checked by hand
          const c = parse(cs.backgroundColor);
          if (c.length === 3 || (c.length === 4 && c[3] === 1)) return c.slice(0, 3);
        }
        return parse(getComputedStyle(document.body).backgroundColor).slice(0, 3);
      };
      const out = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n; (n = walker.nextNode());) {
        const el = n.parentElement;
        if (!n.textContent.trim() || (!el.checkClientRects?.() && !el.getClientRects().length)) continue;
        const cs = getComputedStyle(el);
        if (
          cs.visibility === "hidden" ||
          parseFloat(cs.fontSize) === 0 ||
          el.closest("[hidden],details:not([open]) > :not(summary)")
        )
          continue;
        if (el.closest(":disabled,[aria-disabled=true]")) continue; // WCAG 1.4.3 exempts inactive controls
        const bg = bgOf(el);
        if (!bg) continue;
        const fg = parse(cs.color);
        const alpha = fg[3] ?? 1;
        const mixed = fg.slice(0, 3).map((v, i) => v * alpha + bg[i] * (1 - alpha));
        const [x, y] = [lum(mixed), lum(bg)].sort((a, b) => b - a);
        const r = (x + 0.05) / (y + 0.05);
        const size = parseFloat(cs.fontSize),
          bold = +cs.fontWeight >= 700;
        const need = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
        if (r < need) out.push(`${r.toFixed(2)} < ${need} "${n.textContent.trim().slice(0, 40)}" (${size}px)`);
      }
      return out;
    });
    total += bad.length;
    console.log(`${scheme}: ${bad.length} below AA`);
    bad.slice(0, 15).forEach((l) => console.log("   ", l));
    await ctx.close();
  }
  await b.close();
  process.exitCode = total ? 1 : 0;
})();
