// @vitest-environment jsdom
import { expect, it } from "vitest";
import { ago, buckets, scope, statsPage } from "./stats.js";

// fourteen days from Monday 2026-09-21 to Sunday 2026-10-04: one new player a day, a game every other day
const days = Array.from({ length: 14 }, (_, i) => ({
  date: new Date(Date.UTC(2026, 8, 21 + i)).toISOString().slice(0, 10),
  players: 1,
  games: i % 2,
  packs: 3,
  visits: 2,
}));

it("adds the days up into weeks, named by their Monday, and into months", () => {
  expect(buckets(days, "week")).toEqual([
    { key: "2026-09-21", players: 7, games: 3, packs: 21, visits: 14 },
    { key: "2026-09-28", players: 7, games: 4, packs: 21, visits: 14 },
  ]);
  expect(buckets(days, "month").map((b) => [b.key, b.players])).toEqual([
    ["2026-09", 10],
    ["2026-10", 4],
  ]);
  // by day, the latest thirty
  const forty = Array.from({ length: 40 }, (_, i) => ({
    ...days[0],
    date: new Date(Date.UTC(2026, 7, 1 + i)).toISOString().slice(0, 10),
  }));
  const byDay = buckets(forty, "day");
  expect(byDay).toHaveLength(30);
  expect([byDay[0].key, byDay.at(-1).key]).toEqual(["2026-08-11", "2026-09-09"]);
});

it("says how long ago, in its largest whole unit", () => {
  const now = Date.parse("2026-10-02T12:00:00Z");
  expect(ago(null, now)).toBe("never");
  expect(ago("2026-10-02T11:59:30.123456Z", now)).toBe("just now");
  expect(ago("2026-10-02T11:55:00Z", now)).toBe("5 min ago");
  expect(ago("2026-10-02T09:00:00Z", now)).toBe("3 h ago");
  expect(ago("2026-09-30T12:00:00Z", now)).toBe("2 days ago");
});

it("shows the pulse, the totals and four charts, the period picked pressed", () => {
  const data = {
    days,
    totals: { players: 92, games: 66, packs: 400 },
    pulse: { last_pack: "2026-10-02T11:55:00Z", last_game: "2026-10-02T09:00:00Z", in_progress: 1 },
  };
  const picked = [];
  const page = statsPage(data, {
    period: "week",
    onPeriod: (p) => picked.push(p),
    now: Date.parse("2026-10-02T12:00:00Z"),
  });

  expect(page.querySelector(".pulse").textContent).toBe("last pack 5 min ago · last game 3 h ago · 1 game in progress");
  expect([...page.querySelectorAll(".totals dd")].map((d) => d.textContent)).toEqual(["92", "66", "400"]);
  expect([...page.querySelectorAll(".chart")].map((c) => c.dataset.series)).toEqual([
    "players",
    "games",
    "packs",
    "visits",
  ]);
  expect(page.querySelector('[data-series="games"] .total').textContent).toBe("7");
  expect(page.querySelectorAll('[data-series="games"] rect')).toHaveLength(2);

  const buttons = [...page.querySelectorAll(".periods button")];
  expect(buttons.map((b) => [b.textContent, b.getAttribute("aria-pressed")])).toEqual([
    ["day", "false"],
    ["week", "true"],
    ["month", "false"],
  ]);
  buttons[2].click();
  expect(picked).toEqual(["month"]);
});

it("says what the counts leave out", () => {
  expect(scope({ since: "2026-10-03T02:45:00Z", left_out: 4 })).toBe(
    "Counting since Oct 3, 02:45 UTC, leaving out 4 test players. Days are UTC days; bots' packs don't count.",
  );
  expect(scope({ since: null, left_out: 0 })).toBe(
    "Counting from the first day. Days are UTC days; bots' packs don't count.",
  );
});
