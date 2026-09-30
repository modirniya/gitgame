// Addresses. Hash routes need nothing from whatever serves the files, and a game's address is all a device needs to
// open it again (charter decision 9: there is no session to restore).
//   #/                   I-Start
//   #/g/<id>/<player>    the game as <player> sees it
//   #/r/<id>[/<day>]     the game replayed, as the table saw it, from day 0 (as created) to its last closed day

export function route(hash) {
  const [, kind, id, rest] = hash.replace(/^#/, "").split("/");
  if (kind === "g" && id && rest) return { screen: "game", id, player: decodeURIComponent(rest) };
  if (kind === "r" && id) return { screen: "replay", id, day: /^\d+$/.test(rest ?? "") ? Number(rest) : 0 };
  return { screen: "start" };
}
