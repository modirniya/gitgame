# ADR-0009: A landing page at gitgame.online, and the game at /play

*Status: Accepted · Date: 2026-10-01*

## Context

The beta launches publicly on Hacker News and r/git (M13c). Until now gitgame.online served the game itself: a page whose only content is an empty `<main>` that JavaScript fills, with every screen behind a `#/` address. A search engine indexes nothing there, and a link shared on Reddit, Slack or X previews as the bare title. Visitors from a launch post get the game with no word on what it is.

The maintainer decided on 2026-10-01: gitgame.online becomes a landing page made for search and link previews, and the game moves to `/play`. One page, in the game's own look; the launch posts wait for it.

## Decision

`/` serves one static landing page, and `/play` serves the game, both from the same app, image and origin as today. The landing page is a second page of the client's Vite build (`web/index.html`, the game moving to `web/play/index.html`). It is plain HTML that search engines read without running anything, with its title, description, canonical address, Open Graph and structured data. The build also emits `robots.txt` and `sitemap.xml`, with the domain taken from `brand.js`.

Every link the server or the client writes points to `/play`. Links already out there keep working. One kind carries a query (`/?via=…` from notifications and emails, `/?email=…`, `/?github=…`); the server redirects those to `/play` with the same query, and the browser keeps the `#/…` part. The other kind carries only a hash (a room link like `/#/room/…`); a few lines of script on the landing page send those to `/play`.

## Alternatives considered

- **The landing page on GitHub Pages, the game on a subdomain** (play.gitgame.online). Pages can only own the whole domain, not `/` alone, so the game would have to move to another host name. The session cookie belongs to gitgame.online, so every anonymous player (all of them, today) would lose their games. It would also mean a second deploy and a DNS change. Same origin keeps all of that as it is.
- **Keep the game at `/`, and add metadata to its page.** Link previews would work, but search engines would still find a page with no words in it.
- **A static site generator or a framework for the page.** A dependency with a lasting cost, for one page that plain HTML and the build we already have can serve.

## Consequences

- The client's build has two pages. `web/` holds the landing page beside the game, and shares the game's stylesheet, so the two look alike without a second design to keep.
- The landing page's words describe rules that are still v0.2 (ADR-0002); a rules change must check them.
- The PWA starts at `/play`, and the service worker's offline page is the game's.
- Shared links that predate this keep working only through the redirects above; they stay as long as old links might.
- Its name and domain come from `brand.js`, like everywhere else ([branding.md](../branding.md)); the preview image has the name drawn into it, so a rename means making that image again.

## Supersedes / superseded by

None.
