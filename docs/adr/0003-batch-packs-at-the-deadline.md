# ADR-0003: Resolve a day's packs together, at the deadline

*Status: Accepted · Date: 2026-09-29*

## Context

The [charter](0000-project-charter.md)'s decision 11 is "Process on arrival. The remote resolves a pack the instant it lands", with a note that playtest question 1 might flip it to deadline-batching, which would be "a resolver change, not an architecture change". [round-resolution.md](../design/round-resolution.md) §4 expected neither sending first nor sending last to dominate.

[ADR-0002](0002-beta-before-human-playtest.md) moved the human playtest to the beta and asked for a simulation of each open rules question first. The [pack simulation](../../prototypes/packs/README.md) (4,000 games per condition, bots sharing one policy) found that under arrival order **sending first** dominates: 61% of two-player games, and 30% per early sender with four players (25% is even). It is tempo. Whoever sends second must pull before they can push, most of all on day 1. And because a pull costs nothing when nothing moved, waiting to see what others did buys almost nothing. In a 24h game the edge goes to whoever's day starts first. That is a time-zone advantage in a game whose first locked decision is "async-first".

## Decision

The remote resolves **all of a day's packs together**, when the day closes: at the deadline, or the moment the last pack arrives. It resolves them in a random order drawn from the game's seed. Every pack is written against the remote as it stood when the day opened, and the time a pack is sent no longer matters. This supersedes charter decision 11.

## Alternatives considered

- **Keep processing on arrival.** Rejected for the time-zone advantage above. It does reward sending early, which feeds the notification loop the charter relies on, but it rewards it with wins, not just with engagement.
- **Arrival order, but rotate who is processed first.** Not possible without batching: to put a pack first, the remote must wait for it.
- **Test both in the beta.** The resolver keeps arrival order as a setting (ADR-0002's guardrail), so the beta can still compare them. But the default has to be the fair one.

## Consequences

- **Fair across time zones.** In simulation: 50.5 / 49.5 with two players and 24.8 / 25.2 with four.
- **Conflicts about double** (1.2 → 2.6 per two-player game, 4.7 → 10.1 with four), because everyone writes blind to today's pushes. The beta has to show whether that feels like the "take-that" the charter wants or like noise. Rules v0.2 takes away the merge token for a fast-forward pull, which brings merge tokens most of the way back (5.5 → 3.7 per two-player game), though not the conflicts.
- **Waiting no longer shows you today's moves.** What you know when you write is yesterday's day log. The drama moves from *when* you send to *what you guess* the others will do, closer to simultaneous-move games than to a race.
- **Two-player force-pushes become rare unless someone is willing to force over a single commit.** Under batching you are seldom two commits behind. A player who force-pushes over one big commit does it in about 41% of two-player games and wins 51.5% (±1.5): a real choice, not a mistake. The bot must play it that way, or solo players will never see the moment.
- **The resolver still has the arrival-order setting,** and its property tests run under both orders.
- **`round-resolution.md` changes** in the same change (§3, §4, the worked example) and becomes spec v0.2.

## Supersedes / superseded by

Supersedes [ADR-0000](0000-project-charter.md) decision 11 ("Process on arrival"). The rest of the charter stands.
