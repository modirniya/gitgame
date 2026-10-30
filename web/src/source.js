// The source offer and the legal pages, defined once. Git Game is a network service under the AGPL-3.0, whose section
// 13 asks it to offer everyone who uses it the source of the version they are using: every page's footer (added by
// the web build, vite.config.js) and every screen of the game links the tree of the tag that was deployed. Deploys
// are tags (docs/workflow.md), cut from the release commit that sets package.json's version, and the deploy workflow
// refuses a tag that disagrees with it, so `v${version}` is the version running.
import pkg from "../package.json" with { type: "json" };
import { el } from "./dom.js";

const { version } = pkg;

export const repository = "https://github.com/modirniya/gitgame";
export const sourceHref = `${repository}/tree/v${version}`;

/** The links every page and screen ends with: the source of this version, the privacy policy and the terms. */
export const footLinks = [
  { href: sourceHref, text: `source of v${version} (AGPL-3.0)` },
  { href: "/privacy", text: "privacy" },
  { href: "/terms", text: "terms" },
];

/** The same links as a line of fine print, for the game's screens: the start screen, a room, a game and a replay. */
export const legalFoot = () =>
  el(
    "p",
    { class: "legal-foot" },
    footLinks.map(({ href, text }, i) => [i ? " · " : "", el("a", { href }, text)]),
  );
