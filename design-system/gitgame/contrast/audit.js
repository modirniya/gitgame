// Polish audit for a page: target sizes, minimum text size, clipped text, page overflow and focus visibility, at a
// width and a theme. Usage: node audit.js <url> <width> <dark|light>. Exit 1 on any finding.
const { chromium } = require("playwright");
const [url, width, scheme] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({
    viewport: { width: +width, height: 900 },
    colorScheme: scheme,
    reducedMotion: "reduce",
  });
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil: "networkidle" });
  await p.evaluate((s) => (document.documentElement.dataset.theme = s), scheme);
  const out = await p.evaluate(() => {
    const f = [];
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return (
        r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && !el.closest("details:not([open]) > :not(summary)")
      );
    };
    const name = (el) =>
      (el.getAttribute("aria-label") || el.textContent || el.value || el.tagName)
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 40);
    // 1. targets: controls 44 px tall (and wide, unless they carry text); links 24 px unless inline in prose
    for (const el of document.querySelectorAll(
      "button, summary, input:not([type=checkbox]), select, textarea, a, label.check",
    )) {
      if (!vis(el)) continue;
      const r = el.getBoundingClientRect();
      if (el.tagName === "A") {
        const inline = el.closest("p, li, .site-foot, .row") && getComputedStyle(el).display === "inline";
        if (!inline && r.height < 24)
          f.push(`target ${Math.round(r.width)}×${Math.round(r.height)} link "${name(el)}"`);
        continue;
      }
      const min = el.closest(".segmented") ? 40 : 44;
      if (r.height < min - 0.5 || r.width < min - 0.5)
        f.push(`target ${Math.round(r.width)}×${Math.round(r.height)} ${el.tagName.toLowerCase()} "${name(el)}"`);
    }
    // 2. text under 12 px, 3. clipped text
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = walker.nextNode());) {
      const el = n.parentElement;
      if (!n.textContent.trim() || !vis(el) || el.closest(".visually-hidden, svg, script, style")) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs > 0 && fs < 11.5) f.push(`text ${fs}px "${n.textContent.trim().slice(0, 30)}"`);
    }
    for (const el of document.querySelectorAll(
      ".file, .btn, .status, .name, .label, .cmd, .chip, .who, .tip, .why, .will, summary .title",
    )) {
      if (!vis(el)) continue;
      if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== "visible")
        f.push(`clipped "${name(el)}" ${el.scrollWidth}>${el.clientWidth}`);
    }
    // 4. page overflow
    if (document.documentElement.scrollWidth > innerWidth)
      f.push(`page scrolls sideways: ${document.documentElement.scrollWidth}px`);
    return f;
  });
  // 5. focus: every focusable shows an outline or a ring when focused from the keyboard
  const focusables = await p.$$("a, button:not([disabled]), summary, input:not([disabled]), select, textarea");
  let unfocused = 0;
  for (const h of focusables) {
    if (!(await h.isVisible())) continue;
    const ok = await h.evaluate((el) => {
      el.focus({ focusVisible: true });
      const cs = getComputedStyle(el);
      return (
        document.activeElement !== el ||
        (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2) ||
        cs.boxShadow !== "none"
      );
    });
    if (!ok) unfocused++;
  }
  await p.keyboard.press("Tab"); // keyboard modality, so :focus-visible matches for the checks above
  if (unfocused) out.push(`${unfocused} focusable elements show no focus ring`);
  console.log(`${width}px ${scheme}: ${out.length} findings`);
  [...new Set(out)].slice(0, 25).forEach((l) => console.log("   ", l));
  await b.close();
  process.exitCode = out.length ? 1 : 0;
})();
