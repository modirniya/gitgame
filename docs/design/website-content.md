# Website content: the pages beside the game

*Status: Current · Last verified: 2026-10-04*

What gitgame.online has beyond the landing page ([ADR-0009](../adr/0009-a-landing-page-and-the-game-at-play.md)) and the game: pages that turn the game's own events into addresses a search engine can find and a person can share. Decided on 2026-10-04 from the evidence in [website-content-research.md](website-content-research.md): three doors, content pages before any feature, and Git's words captured, never typed. The pages are built as M16 in [phase-1-plan.md](phase-1-plan.md).

## 1. The shape: three doors

| Door | For | What is behind it |
|---|---|---|
| `/git` | someone with a line of Git's output in front of them | one page per line the game prints, and one per predicament it puts you in |
| `/teach` | a teacher | a lesson on 60-second days, and the print-and-play deck |
| `/teams` | a team lead | a 15-minute game inside a meeting you already have, and the team's Git conventions |

`/teach` and `/teams` start as single pages and split only when a second page exists. Each address reads as the page in a search result (`/git/non-fast-forward`), and `/teams` is where the charter's Orgs/Teams tier (decision 19) walks in later, so it is a flag, not a rewrite. The landing page's header links to each door as it opens. The game at `/play` stays out of search results; every door and page is in the sitemap.

Decided against: one hub at `/learn` with everything beneath it. Simpler to keep, but a teacher landing there meets error messages first, and the addresses would say "learn" rather than what the page is for.

## 2. The pages

Wave 1 ships before the launch (M13c), so the launch leaves pages behind it; wave 2 after it.

### Wave 1

| Page | Address | The game's own line or card | Status |
|---|---|---|---|
| What Git said (the door) | `/git` | the transcript | built |
| Rejected: non-fast-forward | `/git/non-fast-forward` | `! [rejected]        main -> main (non-fast-forward)`, and `(fetch first)` | built |
| Forced update | `/git/forced-update` | ` + 8e1da02...b0ba026 main -> main (forced update)` | built |
| Merge conflict | `/git/conflict` | `CONFLICT (content): Merge conflict in api.py` | built |
| Nothing to do, two spellings | `/git/already-up-to-date` | `Already up to date.` and `Everything up-to-date` | built |
| Fast-forward and rebased | `/git/fast-forward` | `Fast-forward`, `Successfully rebased and updated refs/heads/main.` | built |
| Someone force-pushed over my commit | `/git/force-pushed-over-me` | card: `reflog` | built |
| My push was rejected | `/git/push-rejected` | the pack's pull before each push | built |
| I lost a commit | `/git/lost-commit` | card: `reflog` | built |
| Who broke main | `/git/who-broke-main` | card: `blame`; tabletop: `bisect` | built |
| Undo a commit that's on main | `/git/undo-on-main` | card: `revert` | built |
| Teach (the door, one page) | `/teach` | the guided first game, `tabletop/print-and-play.pdf` | planned |
| Teams (the door, one page) | `/teams` | a room link, 5-minute days | planned |

### Wave 2

| Page | Address | Status |
|---|---|---|
| How it works, the engineering write-up | `/notes/how-it-works` | planned, drafted for launch week |
| Force-push and protected branches | `/teams/force-push` | planned |
| Rebase or merge | `/teams/rebase-or-merge` | planned |
| Trunk, GitHub Flow, Gitflow | `/teams/branching` | planned |
| What's new in Git, one entry per release | `/git/whats-new` | planned; the first entry is Git 2.98, December 2026 |

### Later, with the remote

Not pages, so not here: public result pages with a per-game preview image, "play this exact line" seeded games (the guided game's seed search with one more predicate), and a daily seeded room. Each needs its own decision and an ADR.

## 3. What every page is

One shape, filled once per page, in the order a searcher arrives: with the line in front of them.

1. The line, as Git printed it, first.
2. What Git checked, in a paragraph or two.
3. What to do now: the commands, each with its own captured output.
4. Why the game does this to you: the pack, the day closing, the random order, in the project's words ([conventions.md §5](../conventions.md)).
5. One tap into a game: today the bot, later a seeded day.
6. A note naming the Git that printed the output and the script that captured it.

About 900 to 1,400 words, a `TechArticle` in structured data, a canonical address, and the landing page's preview image. No scripts of its own, so the Content Security Policy is the landing page's.

## 4. Captured, never typed

Every line of Git's output on a page is captured by `scripts/git-output.sh`, which builds each scenario in a scratch directory with fixed authors and dates, so the hashes are the same on every run, and writes `web/captures/<scenario>.txt` as a terminal leaves it. A page holds `%CAPTURE:<scenario>%` where the capture goes and `%GIT_VERSION%` where the Git that printed it is named; the build (`web/vite.config.js`) fills both and fails on a capture the script never wrote. The test beside `web/src/pages.js` checks that a page quotes only captures that exist.

The pages are written against Git 2.56.0. The script warns when it runs another Git and writes the version it ran into every capture, so a page never claims a version it wasn't checked against. A new Git release means running the script again and reading the diff; the prose changes only where the output did.

Known: the captures in the repository are from Git 2.50.1 (Apple Git-155), the Git on the maintainer's machine on 2026-10-04. They are captured again with 2.56.0 before the launch (M16f).

## 5. How the pages are built and served

- `web/src/pages.js` is the one list: a page's `path` is its address and its file is `web/<path>/index.html`. The build takes its inputs and the sitemap from it; the test beside it checks each page's title, description, canonical address and way into the game, and that the door at `/git` links every page under it.
- The remote serves `/git` and `/git/<page>` from the built client (`GitGameWeb.ClientController.git/2`): a page's name is letters, digits and dashes, and a name the build didn't write is a plain 404.
- In development, Vite serves a page at its address without a trailing slash, as the remote does.
- Each page's words describe rules v0.2, so a rules change checks them, as ADR-0009 has it check the landing page.

## 6. Measuring it

Nothing is recorded on the pages. Impressions and clicks per page come from Google Search Console, which needs a DNS record and nothing on the site (the maintainer's to set up). Visits and games stay the pulse's at `/stats`. Which page a game came from is not measured: that would widen the `?via=` sources the beta report counts as prompted (`GitGame.Beta`), a measurement decision for M13d, not a page.

## 7. Open

- The licence for the pages' prose and the print-and-play deck: CC BY-SA 4.0 is the working choice (2026-10-04), to be stated on `/teach` and in the README's licence section when `/teach` is built. Until then the pages carry no licence line of their own and the repository's AGPL applies.
- Whether three links fit the landing page's header on a phone once `/teach` and `/teams` open; if not, "what Git said" moves under the hero.
