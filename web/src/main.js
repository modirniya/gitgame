// The client's entry: signs the device in (anonymously, the first time: ADR-0005), mounts the screen the address names
// (route.js), and registers the service worker.
import { mount } from "./dom.js";
import { remote as makeRemote } from "./api.js";
import { startScreen } from "./start.js";
import { gameScreen } from "./game.js";
import { replayScreen } from "./replay.js";
import { roomScreen } from "./room.js";
import { route } from "./route.js";

const root = document.getElementById("app");
const remote = makeRemote();
// Nobody fills in a form to play (charter priority 2): a device with no session becomes a new anonymous player. `me`
// is `{player, link_github}` once settled, or null if the remote couldn't be reached (the screens say so themselves).
let me = null;
let failure = null;
// A link from a notification says so (`?via=notification`, ADR-0006), and the beta counts that visit apart (M12).
const params = new URLSearchParams(location.search);
const via = params.get("via");
const signedIn = remote
  .me(via)
  .then((m) => m ?? remote.join())
  .then(
    (m) => (me = m),
    (e) => (failure = e),
  );

// Back from GitHub without a link (refused, or the trip broke): say so once. Either way, what the address said is
// taken out of it, so a reload doesn't count or say it again.
let notice = params.get("github") === "failed" ? "GitHub wasn't linked: the trip there and back didn't finish." : "";
if (notice || via) history.replaceState(null, "", location.pathname + location.hash);

async function signOut() {
  await remote.signOut();
  location.reload();
}

let leave = () => {};

function go(path) {
  location.hash = path;
}

function render() {
  leave();
  leave = () => {};
  const where = route(location.hash);

  if (where.screen !== "start") {
    const screen =
      where.screen === "game"
        ? gameScreen({ remote, go, id: where.id, seat: where.seat, me })
        : where.screen === "room"
          ? roomScreen({ remote, go, code: where.code })
          : replayScreen({ remote, go, id: where.id, day: where.day });
    leave = screen.leave;
    mount(root, screen.node);
  } else {
    mount(root, startScreen({ remote, go, me, failure, notice, signOut }));
    notice = "";
  }
}

// every screen talks to the remote as this device's player, so none mounts before the sign-in has settled
signedIn.then(() => {
  window.addEventListener("hashchange", render);
  render();
});

if (import.meta.env.PROD && "serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");
