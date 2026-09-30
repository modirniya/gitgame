// The client's entry: mounts the screen the address names (route.js) and registers the service worker.
import { mount } from "./dom.js";
import { remote as makeRemote } from "./api.js";
import { startScreen } from "./start.js";
import { gameScreen } from "./game.js";
import { route } from "./route.js";

const root = document.getElementById("app");
const remote = makeRemote();

let leave = () => {};

function go(path) {
  location.hash = path;
}

function render() {
  leave();
  leave = () => {};
  const where = route(location.hash);

  if (where.screen === "game") {
    const screen = gameScreen({ remote, go, id: where.id, player: where.player });
    leave = screen.leave;
    mount(root, screen.node);
  } else {
    mount(root, startScreen({ remote, go }));
  }
}

window.addEventListener("hashchange", render);
render();

if (import.meta.env.PROD && "serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");
