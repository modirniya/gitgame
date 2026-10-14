# Trademarks

*Status: Current · Last verified: 2026-10-13*

Our own record of the permission this project uses the Git trademark under, and what we agreed to in return.

## The Git trademark

Git® is a trademark of [Software Freedom Conservancy](https://sfconservancy.org). Used with permission.

Software Freedom Conservancy holds the Git trademark for the Git project. Its general counsel granted [NeuEra LLC](https://legal.neuera.app), which runs this project, permission to use the name "Git Game" for it.

### What the permission is

- **Royalty-free.** We pay nothing for it.
- **Worldwide.**
- **Ends on notice.** Either side may end it on reasonable and fair notice. If it ends, the project changes its name; [docs/branding.md](docs/branding.md) is how that stays a one-pass job.

### What we agreed to

1. **The notice.** Both the online and the physical versions of the game carry this notice, in exactly these words, with "Software Freedom Conservancy" linked to https://sfconservancy.org where a link is possible:

   > Git® is a trademark of Software Freedom Conservancy. Used with permission.

   Where it is today:
   - the footer of every page on [gitgame.online](https://gitgame.online), added by the web build (`web/vite.config.js`) so a new page has it without asking;
   - the game's start screen at [gitgame.online/play](https://gitgame.online/play) (`web/src/start.js`);
   - the cover of the print-and-play deck (`tabletop/build.py`, `tabletop/print-and-play.pdf`);
   - the app's install description (the PWA manifest);
   - [README.md](README.md) and this file.

   The wording is defined once, in `web/src/brand.js`, and is never reworded.
2. **Quality inspection.** Software Freedom Conservancy may inspect the product for quality at any time: the site, the game, the deck and this repository.

### What we don't claim

- "Used with permission" is the whole of the claim. The Git project does not endorse, sponsor, or have any part in this game, and nothing we publish may say or suggest that it does.
- We don't use the Git logo or any of the Git project's artwork, anywhere.
- We don't claim "Git" as a trademark of our own.

## Our license is unchanged

The permission is about the name only. The project stays non-commercial and free: the code and documentation are under the [GNU AGPL-3.0-or-later](LICENSE), and the pages and the deck under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) ([ADR-0010](docs/adr/0010-pages-and-deck-under-cc-by-sa.md)).
