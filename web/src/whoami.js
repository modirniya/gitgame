// Who this device is (ADR-0005): a handle, and once GitHub is linked, its login and avatar. Linking is a page
// navigation to the remote (`/api/auth/github`), which comes back here signed in. Signing out is offered only to a
// linked player: an anonymous one would lose their games with nothing to sign back in with.
import { el } from "./dom.js";

const LINK = "/api/auth/github";

/** The identity bar: handle, avatar, and what this device can do about who it is. `me` is `{player, link_github}`. */
export function whoami(me, { signOut }) {
  const { player, link_github: canLink } = me;
  const github = player.github;

  return el(
    "header",
    { class: "whoami" },
    github?.avatar_url && el("img", { class: "avatar", src: github.avatar_url, alt: "", width: 24, height: 24 }),
    el("span", { class: "handle" }, player.handle),
    github && el("span", { class: "muted" }, `@${github.login}`),
    !github && canLink && el("a", { href: LINK }, "link GitHub"),
    github && el("button", { class: "link", onclick: signOut }, "sign out"),
  );
}

/** The nudge after a finished game, for a player whose games live only in this browser. */
export function nudge(me) {
  if (me.player.github || !me.link_github) return null;
  return el(
    "p",
    { class: "nudge" },
    `This browser is the only key to ${me.player.handle}'s games. `,
    el("a", { href: LINK }, "Link GitHub"),
    " to keep them on any device.",
  );
}
