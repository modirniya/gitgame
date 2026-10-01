// Who won, and "what decided it", on the scoreboard (event-screens §3, O-Scoreboard): one sentence saying who won, by
// how much, and which part of the score made the difference, from the remote's breakdown of each total.

const PARTS = {
  lines: "lines shipped",
  fixes: "fixes",
  blame: "blame",
  sins: "sins",
  grudges: "grudges",
  merge: "merge tokens",
};

/**
 * Who won, as the remote decides it (`GitGame.Release.winners`): the highest total, or the least blame once
 * production is down (`down`), when the release failed. Ties share the win.
 */
export function winners(scores, down = false) {
  const key = down ? "blame" : "total";
  const best = Math.max(...Object.values(scores).map((s) => s[key]));
  return Object.keys(scores).filter((id) => scores[id][key] === best);
}

/** The sentence for a finished game's `scores` (`{seat: {total, lines, fixes, blame, sins, grudges, merge}}`). */
export function whatDecidedIt(scores, down = false) {
  const ranked = Object.entries(scores).sort(([, a], [, b]) => (down ? b.blame - a.blame : b.total - a.total));
  if (ranked.length < 2) return "";
  const [[winner, w], [second, s]] = ranked;
  // a failed release is decided by blame alone, whatever the totals say
  if (down)
    return w.blame === s.blame
      ? `Production went down, and ${winner} and ${second} share the least blame (${w.blame}).`
      : `Production went down, so the least blame won: ${winner} at ${w.blame}, ${second} at ${s.blame}.`;
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
