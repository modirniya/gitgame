# Workflow

*Status: Current · Last verified: 2026-09-29*

How changes get in, and how releases get out. Small, boring, and the same every time.

## Branches

- `main` is the trunk. It is protected: no direct pushes, PRs only, CI must pass.
- Work happens on short-lived branches named `type/short-description`, for example `feat/pack-resolver`, `fix/push-rejected-cost`, `docs/lifecycle`. Types match the commit types below.
- Branches live for days, not weeks. Rebase onto `main` rather than merging `main` in.
- No long-lived `develop`, `release/*`, or personal branches on the shared remote.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/), enforced in review:

```
type(scope): short imperative summary

Optional body: the why, not the what. Wrap at 72 columns.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
```

- **Types:** `feat`, `fix`, `docs`, `rules` (a change to game rules or `rules/` data), `refactor`, `test`, `chore`, `ci`.
- **Scope** is optional and is a directory or module: `server`, `web`, `resolver`, `adr`.
- **AI trailer:** when AI produced a substantial part of the commit, add the `Co-Authored-By` trailer for the model that did (see [AI_DISCLOSURE.md](../AI_DISCLOSURE.md)).
- Commit messages are read by `git log` a year from now. "wip", "fix", and "asdf" draw a bug card in the game and are rejected here too.

## Pull requests

- Squash-merged. The squash message is the PR title, so the PR title follows Conventional Commits too.
- One approving review from a maintainer. Review looks for: does this need to exist, is it readable without context, is it accurate to Git, is it tested, is it documented.
- The PR template is not optional. The AI-use field is answered honestly.
- Drafts are welcome for early feedback; mark them as drafts.

## Versioning

Semantic Versioning. Pre-1.0, minor versions may break things; the changelog says when.

- `0.x.y` while the charter's Phase 2 or earlier.
- `1.0.0` when strangers can complete games unassisted and the rules are stable (Phase 3 exit).

## Releases

1. Move *Unreleased* in `CHANGELOG.md` under a version heading with today's date.
2. Commit `chore(release): vX.Y.Z`.
3. Tag `vX.Y.Z` (annotated, `git tag -a`) and push the tag.
4. Publish a GitHub Release from the tag with the changelog section as the body.

Deploys of the hosted service track tags, never branches.

## Decisions

Anything that changes a locked line of the charter, adds a dependency with a lasting cost, or picks between real alternatives gets an ADR before the code. See [adr/README.md](adr/README.md).
