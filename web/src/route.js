// Addresses. Hash routes need nothing from whatever serves the files, and a game's address is all a device needs to
// open it again (charter decision 9: there is no session to restore).
//   #/                   I-Start
//   #/g/<id>/<player>    the game as <player> sees it

export function route(hash) {
  const [, kind, id, player] = hash.replace(/^#/, "").split("/");
  if (kind === "g" && id && player) return { screen: "game", id, player: decodeURIComponent(player) };
  return { screen: "start" };
}
