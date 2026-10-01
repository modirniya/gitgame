import { describe, expect, it } from "vitest";
import { apply, opening, playback } from "./playback.js";
import game from "./game.fixture.json";

// `game` is a whole game the server played (seed 7, ana and bot), as ana read it: see moments.test.js.
const view = { main: game.main, players: game.players, scores: game.scores, days: game.days };
const next = (i) => game.days[i + 1]?.opened ?? view;
const fold = (day) => day.log.reduce((t, e) => apply(t, e, view), opening(day));

describe("a day folded from its opening table", () => {
  it("ends every day on the table the next day opened on, commit for commit and pointer for pointer", () => {
    game.days.forEach((day, i) => {
      const end = fold(day);
      const then = next(i);
      expect(
        end.main.map((c) => c.id),
        `day ${day.day}`,
      ).toEqual(then.main.map((c) => c.id));
      expect(end.pointers, `day ${day.day}`).toEqual(
        Object.fromEntries(Object.entries(then.players).map(([id, p]) => [id, p.pointer])),
      );
      // the release flips everything at the end of the last day; before it, what is face-up is what was flipped
      if (game.days[i + 1])
        expect(
          end.main.map((c) => [c.id, !!c.flipped, c.files, c.lines]),
          `day ${day.day}`,
        ).toEqual(then.main.map((c) => [c.id, !!c.flipped, c.files, c.lines]));
    });
  });

  it("draws a pushed commit face-down, whatever later flipped it", () => {
    const pushed = game.days[0].log.find((e) => e.type === "push_accepted");
    const end = apply(opening(game.days[0]), pushed, view);
    const c = end.main.find((x) => x.id === pushed.commits[0]);
    expect(c.flipped).toBe(false);
    expect("bug" in c).toBe(false);
  });

  it("takes main back to the pusher's pointer on a force-push, and a reflog puts the erased back on top", () => {
    const at = { main: [{ id: "i", initial: true }, { id: "a" }, { id: "b" }], pointers: { ana: 3, raj: 1 } };
    const v = { main: [{ id: "a" }, { id: "b" }, { id: "f", author: "raj", files: ["api.py"], lines: 3 }] };
    const forced = apply(at, { type: "forced", player: "raj", erased: ["a", "b"], pushed: ["f"] }, v);
    expect(forced.main.map((c) => c.id)).toEqual(["i", "f"]);
    expect(forced.pointers).toEqual({ ana: 1, raj: 2 });

    const back = apply(forced, { type: "reflog_fired", player: "ana", restored: ["a", "b"] }, v);
    expect(back.main.map((c) => c.id)).toEqual(["i", "f", "a", "b"]);
    expect(back.pointers.ana).toBe(4);
  });
});

describe("the steps of a day", () => {
  const steps = game.days.map((day, i) => playback(day, view, { you: "ana", next: next(i) }));

  it("gives each of your remote ops a step, and folds the routine the hub already showed you", () => {
    const mine = steps.flat().filter((s) => s.kind === "moment" && s.moment.player === "ana");
    const kinds = new Set(mine.map((s) => s.moment.kind));
    expect(kinds.has("pushed")).toBe(true);
    expect(kinds.has("staged")).toBe(false);
    expect(kinds.has("committed")).toBe(false);
    // every push of yours that landed is a step, not only the first in the game
    const pushes = game.days.flatMap((d) => d.log).filter((e) => e.type === "push_accepted" && e.player === "ana");
    expect(mine.filter((s) => s.moment.kind === "pushed")).toHaveLength(pushes.length);
  });

  it("folds the bot's staging and its pulls that changed nothing into its next step, which moves on by itself", () => {
    const theirs = steps.flat().filter((s) => s.kind === "moment" && s.moment.player === "bot");
    expect(theirs.some((s) => s.moment.kind === "staged" || s.moment.kind === "pull_noop")).toBe(false);
    const built = theirs.find((s) => s.moment.kind === "committed");
    expect(built.folded.map((m) => m.kind)).toEqual(["staged"]);
    expect(
      theirs.filter((s) => !["blamed", "forced", "rejected", "conflict"].includes(s.moment.kind)).every((s) => s.auto),
    ).toBe(true);
    // a few steps a day at most, as the prototype's findings asked
    for (const day of steps) expect(day.filter((s) => s.moment?.player === "bot").length).toBeLessThanOrEqual(4);
  });

  it("draws each step on the table as the step before left it", () => {
    for (const day of steps) {
      const moves = day.filter((s) => s.kind === "moment");
      moves
        .slice(1)
        .forEach((s, i) => expect(s.before.main.length).toBeLessThanOrEqual(moves[i].after.main.length + 1));
      const pushed = moves.find((s) => s.moment.kind === "pushed");
      if (pushed)
        expect(pushed.after.main.length).toBe(pushed.before.main.length + pushed.moment.events.at(-1).commits.length);
    }
  });

  it("ends every day on its receipt: your ops, the scores as the day opened and closed, and where you stand", () => {
    steps.forEach((day, i) => {
      const end = day.at(-1);
      expect(end.kind).toBe("summary");
      expect(end.order).toContain("ana");
      expect(end.scores.before).toEqual(game.days[i].opened.scores);
      expect(end.scores.after).toEqual(next(i).scores);
      expect(end.behind).toBe(next(i).players.ana.behind);
      expect(end.mine.every((m) => m.player === "ana" && m.command)).toBe(true);
    });
  });
});
