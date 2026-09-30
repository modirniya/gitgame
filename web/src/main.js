// The client's entry: signs the device in (anonymously, the first time: ADR-0005), mounts the screen the address names
// (route.js), and registers the service worker.
import { mount } from "./dom.js";
import { remote as makeRemote } from "./api.js";
import { startScreen } from "./start.js";
import { gameScreen } from "./game.js";
import { replayScreen } from "./replay.js";
import { route } from "./route.js";

const root = document.getElementById("app");
const remote = makeRemote();
// Nobody fills in a form to play (charter priority 2): a device with no session becomes a new anonymous player. `me`
// is `{player, link_github}` once settled, or null if the remote couldn't be reached (the screens say so themselves).
let me = null;
let failure = null;
const signedIn = remote
  .me()
  .then((m) => m ?? remote.join())
  .then(
    (m) => (me = m),
    (e) => (failure = e),
  );

// Back from GitHub without a link (refused, or the trip broke): say so once, and take it out of the address.
const params = new URLSearchParams(location.search);
let notice = params.get("github") === "failed" ? "GitHub wasn't linked: the trip there and back didn't finish." : "";
if (notice) history.replaceState(null, "", location.pathname + location.hash);

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

  if (where.screen === "game" || where.screen === "replay") {
    const screen =
      where.screen === "game"
        ? gameScreen({ remote, go, id: where.id, seat: where.seat, me })
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
