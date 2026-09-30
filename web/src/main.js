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
// Nobody fills in a form to play (charter priority 2): a device with no session becomes a new anonymous player.
const me = remote.me().then((player) => player ?? remote.join());

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
        ? gameScreen({ remote, go, id: where.id, seat: where.seat })
        : replayScreen({ remote, go, id: where.id, day: where.day });
    leave = screen.leave;
    mount(root, screen.node);
  } else {
    mount(root, startScreen({ remote, go, me }));
  }
}

// every screen talks to the remote as this device's player, so none mounts before the sign-in has settled
me.finally(() => {
  window.addEventListener("hashchange", render);
  render();
});

if (import.meta.env.PROD && "serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");
