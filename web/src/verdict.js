// "What decided it", on the scoreboard (event-screens §3, O-Scoreboard): one sentence saying who won, by how much, and
// which part of the score made the difference, from the remote's breakdown of each total.

const PARTS = {
  lines: "lines shipped",
  fixes: "fixes",
  blame: "blame",
  sins: "sins",
  grudges: "grudges",
  merge: "merge tokens",
};

/** The sentence for a finished game's `scores` (`{seat: {total, lines, fixes, blame, sins, grudges, merge}}`). */
export function whatDecidedIt(scores) {
  const ranked = Object.entries(scores).sort(([, a], [, b]) => b.total - a.total);
  if (ranked.length < 2) return "";
  const [[winner, w], [second, s]] = ranked;
  if (w.total === s.total) return `A tie at ${w.total}, between ${winner} and ${second}.`;

  // the part where the winner gained most on the runner-up
  const [part, gap] = Object.keys(PARTS)
    .map((k) => [k, (w[k] ?? 0) - (s[k] ?? 0)])
    .sort(([, a], [, b]) => b - a)[0];

  const by = w.total - s.total;
  return gap > 0
    ? `${winner} won by ${by}, most of it in ${PARTS[part]} (+${gap} over ${second}).`
    : `${winner} won by ${by}.`;
}
