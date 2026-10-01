// The pack editor's model: a day's ops in the exact shapes the remote decodes (server/lib/gitgame/games/pack.ex), and
// what each will cost when it runs. Costs come from the view (`costs`, the game's own rules), and some depend on what
// other packs do first: with packs resolved in a random order at the deadline (ADR-0003), a pull that is free now
// costs 1 if someone pushes before you. So each op gets the cost it has now and the most it could cost.
//
// Local ops (add, commit, arm) touch only your side of the table, so the model follows them exactly; remote ops are
// estimates from what you can see.

const files = (cards) => [...new Set(cards.map((c) => c.file))];
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** What each conflict strategy does, in the words the pack editor offers it in (round-resolution §3). */
export const STRATEGIES = { theirs: "keep theirs", ours: "keep mine", resolve: "keep both, by hand" };

/** Your side of the table as the view shows it, before any op of the pack. */
function start(view) {
  const you = view.you;
  const me = view.players[you.player];
  return {
    hand: you.hand,
    staged: you.staged,
    // your unpushed commits, those already made and those the pack makes, and what the pack pushes of them
    local: you.local.map((c) => ({ id: c.id, cards: c.cards, message: c.message, files: files(c.cards) })),
    pushed: [],
    armed: you.armed,
    behind: me.behind,
    // the commits you would pull, and whose files they touch: a conflict can be seen coming
    incoming: view.main.slice(me.pointer).filter((c) => !c.overwritten && !c.revert_of),
  };
}

const card = (s, command) => s.hand.find((c) => c.command === command);
const without = (cards, gone) => cards.filter((c) => !gone.includes(c));

/** What `op` costs from state `s`, the most it could cost, a note, and the state after it. */
function step(view, s, op) {
  const k = view.costs.ops;
  const command = (id) => view.costs.commands[id];

  switch (op.op) {
    case "add": {
      const picked = s.hand.filter((c) => op.cards.includes(c.id));
      const bug = picked.some((c) => c.bug);
      return [
        k.add,
        k.add,
        bug ? "stages a bug" : null,
        { ...s, hand: without(s.hand, picked), staged: [...s.staged, ...picked] },
      ];
    }

    case "commit": {
      if (!s.staged.length) return [k.commit, k.commit, "nothing added to commit", s];
      const lines = s.staged.reduce((n, c) => n + c.lines, 0);
      const made = { id: null, cards: s.staged, message: op.message ?? "", files: files(s.staged) };
      return [k.commit, k.commit, `+${lines} lines`, { ...s, staged: [], local: [...s.local, made] }];
    }

    case "pull": {
      const base = op.rebase ? k.pull_rebase : k.pull;
      const hits = (mine) => s.incoming.flatMap((c) => c.files.filter((f) => mine.files.includes(f)));
      const clash = s.local.flatMap(hits);
      const strategy = op.strategy ?? view.default_strategy;
      const extra = strategy === "resolve" ? k.resolve_by_hand_extra : 0;
      // -X theirs drops each of your commits that clashes; ours and resolve keep them
      const local = strategy === "theirs" ? s.local.filter((mine) => !hits(mine).length) : s.local;
      const after = { ...s, behind: 0, incoming: [], local };

      if (s.behind === 0)
        return [k.pull_when_up_to_date, base + extra, "free if nothing moved; more if someone pushes first", after];
      const note = clash.length
        ? `CONFLICT coming in ${[...new Set(clash)].join(", ")}: ${STRATEGIES[strategy]}`
        : op.rebase
          ? "rebases your commits on the tip"
          : s.local.length
            ? "merges: takes a merge token"
            : "fast-forwards to the tip";
      return [base + (clash.length ? extra : 0), base + extra, note, after];
    }

    case "push":
      // nobody else can add to your branch, so a push of nothing is free whatever runs first
      if (!s.local.length)
        return [k.push_with_nothing_to_push, k.push_with_nothing_to_push, "nothing to push: free", s];
      if (s.behind > 0) return [k.push, k.push, "! [rejected] you're behind: pull first", s];
      return [
        k.push,
        k.push,
        "accepted unless someone pushes first",
        { ...s, local: [], pushed: [...s.pushed, ...s.local] },
      ];

    case "blame":
      return [
        command("blame"),
        command("blame"),
        `flips ${op.target}`,
        { ...s, hand: without(s.hand, [card(s, "blame")]) },
      ];

    case "revert":
      return [
        command("revert"),
        command("revert"),
        s.behind > 0 ? "! [rejected] you're behind: pull first" : `reverts ${op.target}: +1`,
        { ...s, hand: without(s.hand, [card(s, "revert")]) },
      ];

    case "force":
      return [
        command("force"),
        command("force"),
        s.behind > 0
          ? `erases ${s.behind} commit${s.behind === 1 ? "" : "s"}; you take a sin`
          : "nothing ahead to overwrite",
        {
          ...s,
          hand: without(s.hand, [card(s, "force")]),
          local: [],
          pushed: [...s.pushed, ...s.local],
          behind: 0,
          incoming: [],
        },
      ];

    case "tag":
      return [k.tag, k.tag, "CI flips every commit on main", s];

    case "arm":
      return [
        k.arm_trap,
        k.arm_trap,
        "face-down: fires on a force-push",
        { ...s, hand: without(s.hand, [card(s, "reflog")]), armed: [...s.armed, "reflog"] },
      ];

    default:
      return [0, 0, null, s];
  }
}

/**
 * The pack as it stands: every op with its cost now (`cost`), the most it could cost (`most`), a note, a commit's
 * `cards`, and whether it will run within the budget (`runs`) or only might (`maybe`). `left` is your side after the
 * pack's local ops.
 */
export function price(view, ops) {
  let s = start(view);
  let spent = 0;
  let most = 0;
  const rows = ops.map((op) => {
    // what a commit will be made of: the cards staged when it runs
    const cards = op.op === "commit" ? s.staged : null;
    const [cost, max, note, next] = step(view, s, op);
    s = next;
    spent += cost;
    most += max;
    return {
      op,
      cost,
      most: max,
      note,
      cards,
      runs: spent <= view.budget,
      maybe: most > view.budget && spent <= view.budget,
    };
  });
  return { rows, spent, most, budget: view.budget, full: ops.length >= view.max_ops, left: s };
}

/**
 * The `-X` flag Git spells a strategy with. The pack keeps the game's meaning (`theirs`: their commit wins), but Git
 * names the sides from where the merge runs: during a rebase "ours" is the upstream being rebased onto, so keeping
 * their side is `-X ours`. Resolving by hand has no flag at all: Git stops at the conflict and you fix it.
 */
export function gitFlag(strategy, rebase = false) {
  if (strategy !== "ours" && strategy !== "theirs") return null;
  const swap = { ours: "theirs", theirs: "ours" };
  return `-X ${rebase ? swap[strategy] : strategy}`;
}

// Ops that land on main from your pointer: without a pull first they are rejected once main has moved.
const LANDS = new Set(["push", "revert"]);

/** `ops` with `op` added, and a pull before it if it lands on main and nothing since the last landing has pulled. */
export function add(view, ops, op) {
  if (ops.length >= view.max_ops) return ops;
  if (!LANDS.has(op.op)) return [...ops, op];

  const since = ops.slice(ops.findLastIndex((o) => LANDS.has(o.op) || o.op === "force") + 1);
  const pulled = since.some((o) => o.op === "pull");
  return pulled || ops.length + 2 > view.max_ops ? [...ops, op] : [...ops, { op: "pull" }, op];
}

/** What can be added to the pack now, each with the reason when it can't (the hub greys it out). */
export function actions(view, ops, selected = []) {
  const { left: s, full } = price(view, ops);
  const has = (command) => s.hand.some((c) => c.command === command);
  const commands = view.commands_allowed ? null : `${view.incident?.name}: no command cards today`;
  const theirs = view.main.filter((c) => !c.initial && !c.revert_of && !c.flipped && c.author !== view.you.player);
  const bugs = view.main.filter((c) => c.flipped && c.bug && !c.reverted && !c.overwritten);
  const commits = view.main.length - 1 + (ops.some((o) => o.op === "push") ? 1 : 0);
  const why = (ok, reason) => (full ? `a pack is at most ${view.max_ops} ops` : ok ? null : reason);

  return {
    add: why(
      selected.some((id) => s.hand.find((c) => c.id === id && c.kind === "commit")),
      "select cards in your hand",
    ),
    commit: why(s.staged.length > 0, "nothing added to commit"),
    pull: why(true),
    push: why(true),
    blame: why(
      has("blame") && !commands && theirs.length > 0,
      commands ?? (has("blame") ? "no face-down commit to blame" : "no git blame card"),
    ),
    revert: why(
      has("revert") && !commands && bugs.length > 0,
      commands ?? (has("revert") ? "no face-up bug on main" : "no revert card"),
    ),
    force: why(
      has("force") && !commands && s.behind > 0,
      commands ?? (has("force") ? "nothing ahead of your pointer" : "no push --force card"),
    ),
    tag: ops.some((o) => o.op === "tag")
      ? why(false, "v1.0 is already tagged in this pack")
      : why(
          commits >= view.release_at,
          `main has ${plural(view.main.length - 1, "commit")}; v1.0 needs ${view.release_at}`,
        ),
    arm: why(
      has("reflog") && !s.armed.includes("reflog"),
      has("reflog") ? "a reflog is already armed" : "no reflog card",
    ),
  };
}

/**
 * What today's budget still allows once `ops` have run: the ops left, and the actions that would spend them. Null when
 * the pack spends the day, is full, or nothing left would do anything. A pack that leaves ops unspent, even an empty
 * one, is still the player's to send; the hub only says so first.
 */
export function unspent(view, ops) {
  const { spent, full, left: s } = price(view, ops);
  if (full || spent >= view.budget) return null;
  const cards = s.hand.filter((c) => c.kind === "commit").map((c) => c.id);
  const can = actions(view, ops, cards);
  // a pull at the tip and a push of nothing change nothing, and arming a trap spends no ops
  const idle = { pull: s.behind === 0, push: s.local.length === 0, arm: true };
  const moves = Object.keys(can).filter((k) => !can[k] && !idle[k]);
  return moves.length ? { left: view.budget - spent, moves } : null;
}

/**
 * What each action would do, in your situation now, as a line under its button (event-screens §3, I-Hub): the
 * consequence of playing it, where `actions` says why it can't be.
 */
export function consequences(view, ops, selected = []) {
  const { left: s } = price(view, ops);
  const picked = s.hand.filter((c) => selected.includes(c.id) && c.kind === "commit");
  const lines = (cards) => cards.reduce((n, c) => n + c.lines, 0);

  return {
    add:
      picked.length &&
      `stage ${plural(picked.length, "card")}, +${lines(picked)}${picked.some((c) => c.bug) ? ", a bug" : ""}`,
    commit: s.staged.length && `one commit, +${lines(s.staged)} lines`,
    pull: s.behind > 0 ? `${s.behind} new on main: catch up` : "at the tip: free unless main moves",
    push: s.local.length ? `${plural(s.local.length, "commit")} to main` : "nothing to push yet",
    blame: "flip a face-down commit: −3 to its author if a bug",
    revert: "cancel a flipped bug: +1 to you",
    force: `erase ${plural(s.behind, "commit")} ahead of you; a sin`,
    arm: "free: fires when someone force-pushes",
    tag: "ship v1.0: CI flips every commit",
  };
}
