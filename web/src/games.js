// Your games (M9c), on the start screen: every game you hold a seat in, those waiting on your pack first. This is the
// retention loop inside the client ("your pack is due"); M10 carries it outside, to notifications.
import { el } from "./dom.js";

/** One line about a game, as the list shows it: who it's against, what day, and what it's waiting for. */
export function describe(g) {
  const others = g.seats.filter((s) => !g.yours.includes(s));
  const against = others.length ? `vs ${others.join(", ")}` : "hotseat";

  if (g.released) {
    const you = Math.max(...g.yours.map((s) => g.scores[s]));
    const best = Math.max(...Object.values(g.scores));
    return { against, status: `v1.0 shipped · ${you === best ? "you won" : "you lost"}, ${you}`, due: false };
  }

  const due = g.waiting_on_you.length > 0;
  const whose = g.yours.length > 1 ? ` (${g.waiting_on_you.join(", ")})` : "";
  return {
    against,
    status: `day ${g.day}/${g.final_day} · ${due ? `your pack is due${whose}` : "waiting for the others"}`,
    due,
  };
}

export function gamesList(games) {
  if (!games.length) return null;
  return el(
    "section",
    { class: "your-games", "aria-label": "your games" },
    el("h2", {}, "your games"),
    el(
      "ul",
      {},
      games.map((g) => {
        const d = describe(g);
        return el(
          "li",
          { class: d.due ? "due" : g.released ? "done" : "" },
          el("a", { href: `#/g/${g.id}` }, d.against),
          el("span", { class: "status" }, d.status),
        );
      }),
    ),
  );
}
