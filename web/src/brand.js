// The product's name and domain, defined once. The name is not final (docs/branding.md): everything the client shows a
// person reads it from here, and a rename is one edit plus scripts/brand-audit.sh.

// BRAND
export const name = "Git Game";
export const domain = "gitgame.online";

// The Git trademark notice, word for word as Software Freedom Conservancy asked for it (TRADEMARKS.md): every page's
// footer and the game's start screen carry it, its owner linked. Never reworded.
export const trademark = {
  before: "Git® is a trademark of ",
  owner: "Software Freedom Conservancy",
  href: "https://sfconservancy.org",
  after: ". Used with permission.",
};
export const trademarkText = trademark.before + trademark.owner + trademark.after;
