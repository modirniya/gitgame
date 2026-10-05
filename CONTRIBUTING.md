# Contributing

Thanks for looking. This page is short; the details live in `docs/`.

## Before you start

- Read the [charter](docs/adr/0000-project-charter.md) — especially "Locked decisions" and "What we moved on from". A pull request that re-opens a settled decision without new information will be closed with a pointer here; a proposal *with* new information is welcome as an ADR (see [docs/adr/README.md](docs/adr/README.md)).
- Read [docs/conventions.md](docs/conventions.md) and [docs/workflow.md](docs/workflow.md). They are what reviewers will hold you to.
- If you use AI to help, read [AI_DISCLOSURE.md](AI_DISCLOSURE.md). It's allowed; it must be disclosed and understood.

## Ways to contribute

- **Rules proposals.** The game is the product. Use the *Rules proposal* issue template. The bar is: accurate to Git, and better at the table.
- **Bugs and features.** Use the templates. Small, well-described issues get fixed fastest.
- **Code.** Open an issue first for anything larger than a bug fix, so we agree on the approach before you spend time.
- **Playtesting.** Reports of real games — what was tense, what was boring, where the rules were unclear — are the most valuable thing you can send during Phase 0 and 1.

## Pull requests

1. One concern per PR. Keep it under about 400 changed lines; split it if it grows.
2. Branch from `main`, name it `type/short-description` (see workflow doc).
3. Follow Conventional Commits.
4. Add or update tests for behaviour; add or update docs for anything a user or contributor would notice.
5. Add a line under *Unreleased* in [CHANGELOG.md](CHANGELOG.md) if the change is user-visible.
6. Fill in the PR template completely. Empty sections get the PR sent back.

By contributing you agree that your contribution is licensed under the project license, [AGPL-3.0-or-later](LICENSE), and that you have the right to submit it. The text of the site's pages under `web/git`, `web/teach` and `web/teams`, and the card text in `rules/deck.json`, are under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) instead ([ADR-0010](docs/adr/0010-pages-and-deck-under-cc-by-sa.md)); a contribution to those is made under that licence.

## Conduct

Everyone here follows the [Code of Conduct](CODE_OF_CONDUCT.md).
