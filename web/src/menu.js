// The site header's "menu" (a <details>, so it opens with no script at all): Escape or a tap outside it closes it, and
// Escape gives the keyboard back to its summary. Every page with the menu loads this (vite.config.js).
for (const menu of document.querySelectorAll(".site-head .menu")) {
  const summary = menu.querySelector("summary");
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menu.open) {
      menu.open = false;
      summary.focus();
    }
  });
  document.addEventListener("click", (e) => {
    if (menu.open && !menu.contains(e.target)) menu.open = false;
  });
}
