// The maintainer's pulse (M13e): that the game is being played, not how well. The server counts from a fresh start
// and leaves the team's test players out, by UTC day, and serves this page and /api/stats only behind STATS_TOKEN.
import { el, mount } from "./dom.js";

const SERIES = [
  ["players", "new players"],
  ["games", "games started"],
  ["packs", "packs by people"],
  ["visits", "visits"],
];
// how many of each period the bars show
export const SPAN = { day: 30, week: 12, month: 12 };
const SPAN_TEXT = { day: "the last 30 days", week: "the last 12 weeks", month: "the last 12 months" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// a week is named by its Monday
const monday = (date) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};
const KEY = { day: (date) => date, week: monday, month: (date) => date.slice(0, 7) };

/** The days added up by `period`, the last SPAN[period] of them, oldest first: `{key, players, games, packs, visits}`. */
export function buckets(days, period) {
  const sums = new Map();
  for (const day of days) {
    const key = KEY[period](day.date);
    const sum = sums.get(key) ?? { key, players: 0, games: 0, packs: 0, visits: 0 };
    for (const [s] of SERIES) sum[s] += day[s];
    sums.set(key, sum);
  }
  return [...sums.values()].slice(-SPAN[period]);
}

/** How long ago `iso` was, in its largest whole unit; "never" if it never was. */
export function ago(iso, now = Date.now()) {
  if (!iso) return "never";
  const s = Math.max(0, (now - Date.parse(iso)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return `${d} ${d === 1 ? "day" : "days"} ago`;
}

/** What the counts leave out, in a sentence: before the start (`since`), and the team's test players (`left_out`). */
export function scope({ since, left_out }) {
  const from = since
    ? `Counting since ${MONTHS[since.slice(5, 7) - 1]} ${Number(since.slice(8, 10))}, ${since.slice(11, 16)} UTC`
    : "Counting from the first day";
  const team = left_out ? `, leaving out ${left_out} test ${left_out === 1 ? "player" : "players"}` : "";
  return `${from}${team}. Days are UTC days; bots' packs don't count.`;
}

const label = (key, period) => {
  const [, m, d] = key.split("-");
  return period === "month" ? MONTHS[m - 1] : `${MONTHS[m - 1]} ${Number(d)}`;
};

const svg = (tag, attrs, ...children) => {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  node.append(...children);
  return node;
};

function chart([series, title], bars, period) {
  const most = Math.max(0, ...bars.map((b) => b[series]));
  const total = bars.reduce((n, b) => n + b[series], 0);
  const columns = bars.map((b, i) => {
    // an empty chart scales against 1, so no bar divides by nothing
    const h = (b[series] / Math.max(most, 1)) * 100;
    return svg(
      "rect",
      { x: i * 10 + 1, width: 8, y: 100 - Math.max(h, 1), height: Math.max(h, 1), class: b[series] ? "" : "zero" },
      svg("title", {}, `${label(b.key, period)}: ${b[series]}`),
    );
  });
  return el(
    "section",
    { class: "chart", "data-series": series },
    el(
      "header",
      {},
      el("h2", {}, title),
      el("b", { class: "total" }, String(total)),
      el("span", { class: "muted" }, `in ${SPAN_TEXT[period]}`),
    ),
    svg(
      "svg",
      {
        viewBox: `0 0 ${bars.length * 10} 100`,
        preserveAspectRatio: "none",
        role: "img",
        "aria-label": `${title}, ${total} in ${SPAN_TEXT[period]}`,
      },
      ...columns,
    ),
    el(
      "div",
      { class: "axis" },
      el("span", {}, bars.length ? label(bars[0].key, period) : ""),
      el("span", {}, `most ${most}`),
      el("span", {}, bars.length ? label(bars.at(-1).key, period) : ""),
    ),
  );
}

/** The page for `data` (what /api/stats answers), its bars by `period`; `onPeriod` is told when another is picked. */
export function statsPage(data, { period = "day", onPeriod = () => {}, now = Date.now() } = {}) {
  const { pulse, totals } = data;
  const bars = buckets(data.days, period);
  return el(
    "div",
    { class: "page" },
    el("h1", {}, "pulse"),
    el(
      "p",
      { class: "pulse" },
      "last pack ",
      el("b", {}, ago(pulse.last_pack, now)),
      " · last game ",
      el("b", {}, ago(pulse.last_game, now)),
      " · ",
      el("b", {}, String(pulse.in_progress)),
      pulse.in_progress === 1 ? " game in progress" : " games in progress",
    ),
    el(
      "dl",
      { class: "totals" },
      [
        ["players", "players"],
        ["games", "games"],
        ["packs", "packs by people"],
      ].map(([key, name]) => el("div", {}, el("dt", {}, name), el("dd", {}, String(totals[key])))),
    ),
    el(
      "div",
      { class: "periods", role: "group", "aria-label": "bars by" },
      Object.keys(SPAN).map((p) =>
        el("button", { "aria-pressed": String(p === period), onclick: () => onPeriod(p) }, p),
      ),
    ),
    el(
      "div",
      { class: "charts" },
      SERIES.map((s) => chart(s, bars, period)),
    ),
    el("p", { class: "muted note" }, scope(data)),
  );
}

async function start(root) {
  const res = await fetch("/api/stats");
  if (!res.ok) return mount(root, el("p", { class: "error" }, `fatal: the stats didn't load (${res.status})`));
  const data = await res.json();
  const show = (period) => mount(root, statsPage(data, { period, onPeriod: show }));
  show("day");
}

const root = typeof document !== "undefined" && document.getElementById("stats");
if (root) start(root);
