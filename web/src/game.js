// A game as one player sees it: fetch the view, render it. Opening a game a second later or a week later is the same
// thing (charter decision 9), so this screen holds no game state of its own beyond the last view it fetched.
import { el, mount } from "./dom.js";
import { card } from "./cards.js";
import { table } from "./table.js";

export function gameScreen({ remote, id, player }) {
  const node = el("section", { class: "screen game" });
  let alive = true;

  function render(view) {
    mount(
      node,
      table(view),
      el(
        "section",
        { class: "hand", "aria-label": "your hand" },
        el("h2", {}, "your hand"),
        el(
          "div",
          { class: "cards" },
          view.you.hand.map((c) => card(c)),
        ),
      ),
      el("p", {}, el("a", { href: "#/" }, "new game")),
    );
  }

  function fail(e) {
    mount(node, el("p", { class: "error", role: "alert" }, e.message), el("a", { href: "#/" }, "new game"));
  }

  mount(node, el("p", { class: "muted" }, "$ git fetch"));
  remote.fetchView(id, player).then((view) => alive && render(view), fail);

  return { node, leave: () => (alive = false) };
}
