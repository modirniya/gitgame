# Lifecycle: how things are retired

*Status: Current · Last verified: 2026-09-29*

Projects don't die from missing features. They die from accumulated stuff nobody dares to delete. This document is the permission, and the procedure, to delete.

**The principle:** git history is the archive. Nothing is kept "just in case" in the working tree. If something was ever useful, `git log` can find it again (`git log --diff-filter=D --summary` lists every deleted file, `git log -S'<text>'` finds where text last lived).

## 1. Documents

Every file in `docs/` begins with a status line:

```
*Status: <Draft | Current | Superseded by <link> | Archived> · Last verified: YYYY-MM-DD*
```

| Status | Meaning | What happens to it |
|---|---|---|
| **Draft** | Being written or playtested; may be wrong. | Becomes Current or is deleted. A draft older than 90 days is deleted at gardening unless someone claims it. |
| **Current** | True today. | Re-verified at each gardening pass; the date is updated. |
| **Superseded by …** | A newer doc replaces it. | **Deleted** at the next gardening pass. The link in the status line is copied into the newer doc's history section so no reference is lost. Only ADRs stay. |
| **Archived** | Kept for the record only. | Used **only** for ADRs and for playtest reports. Anything else with this status is a mistake; delete it. |

Rules:

- **ADRs are never deleted.** A reversed decision gets a new ADR that says "supersedes ADR-NNNN"; the old one's status is updated to point forward. That's the whole point of ADRs.
- A design doc, once implemented, either becomes the *Current* reference for that part of the system or is deleted after its decisions are captured in an ADR. It does not linger as a stale plan.
- `CHANGELOG.md` is never pruned.
- "Last verified" older than 180 days on a *Current* doc is a gardening finding.

## 2. Code

- **Deprecate, then delete, on a fixed clock.** Pre-1.0: delete directly, with a changelog line. Post-1.0: mark deprecated in one minor release (a `@deprecated` note or a log warning that names the replacement), remove in the next minor. Nothing stays deprecated for two releases.
- **Feature flags** have an owner and a removal date written at the flag. A flag that has been fully on or fully off for two releases is removed with its dead branch.
- **Dead code** is any function, module, config key, or asset with no callers and no doc reference. Delete it in the same PR where you notice it, if the PR is otherwise small; otherwise open an issue labelled `gardening`.
- **No graveyards.** No commented-out blocks, no `_old` suffixes, no `legacy/`, `v1/`, `backup/`, `archive/` directories. If it's not live, it's in git history.
- **Dependencies** are reviewed at every gardening pass (`mix hex.outdated`, `npm outdated`). A dependency with one call site is a candidate for replacement by that one call.

## 3. Rules and data

- A card, op, or incident removed from `rules/` gets a `rules:` commit and a changelog line, and the base-rules doc is updated in the same PR. The rules doc and the rules data must never disagree.
- Playtest reports go in `docs/design/playtests/` with status *Archived* and the date in the file name. They are the only thing that legitimately accumulates.

## 4. Files that must never be committed

Learned from sibling projects that carry them to this day: `erl_crash.dump`, bug-report zips, build artefacts, `.DS_Store`, logs. `.gitignore` blocks the known ones; if you see a new kind, add it to `.gitignore` in the same PR that removes it.

## 5. Gardening

A **gardening pass** happens at least once a quarter and before every minor release. It is one PR titled `chore(gardening): <date>` and it walks this checklist:

- [ ] Every doc in `docs/`: status still true? Superseded ones deleted? Dates updated?
- [ ] `git grep -n TODO` — each TODO has an issue number or is resolved now.
- [ ] Flags past their removal date.
- [ ] Deprecated items past their clock.
- [ ] Unreferenced files: `scripts/`, images, fixtures, config keys nobody reads.
- [ ] Dependencies: outdated, unused, or single-use.
- [ ] `scripts/brand-audit.sh` runs clean (see [branding.md](branding.md)).
- [ ] `.gitignore` covers any junk that appeared since last time.
- [ ] The repository layout still matches [conventions.md §1](conventions.md).

Issues that come out of a pass are labelled `gardening`. The pass itself should be boring; if it isn't, gardening has been skipped too long.
