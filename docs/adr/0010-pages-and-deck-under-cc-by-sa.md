# ADR-0010: The site's pages and the print-and-play deck under CC BY-SA 4.0

*Status: Accepted · Date: 2026-10-04*

## Context

The website is gaining pages for teachers and teams ([website-content.md](../design/website-content.md), M16), and a page that hands out the print-and-play deck. The repository's licence is the AGPL, for "code and documentation" (README): a software licence, which fits the server and the client and fits a lesson plan or a deck of cards badly. A teacher copying the lesson into a course, or a library printing the deck, needs a licence written for text and artwork, and the resource lists teachers use ask for one, usually a Creative Commons licence. The brand stays outside any licence (charter decision 18).

## Decision

The prose of the site's pages under `/git`, `/teach` and `/teams`, and the print-and-play deck (`tabletop/print-and-play.pdf`, and the card text in `rules/deck.json` it is built from), are licensed under Creative Commons Attribution-ShareAlike 4.0 International. The code, including the scripts that build the deck and the pages, stays under the AGPL-3.0-or-later.

## Alternatives considered

- **CC BY 4.0** — more permissive: a closed derivative of the deck could be sold. ShareAlike keeps derived decks and lessons open, which is what the AGPL does for the code.
- **Leave everything under the AGPL** — a software licence on a lesson plan confuses teachers and fails the resource lists, and its source obligations don't map onto printed cards.
- **CC BY-NC-SA 4.0** — forbids commercial use, which would stop a trainer from using the deck in a paid workshop. That is a use the project wants (charter decision 19, Orgs/Teams).

## Consequences

- Every page under the three doors names the licence in its footer, and the README's licence section names both licences. The deck's cover is rebuilt to name it (a follow-up: `tabletop/build.py`, then the PDF).
- Contributions to the pages and to the card text are made under CC BY-SA 4.0; `CONTRIBUTING.md` says so.
- Selling printed copies stays possible, for the project and for anyone else, which the physical box (charter decision 19c) relies on; the box's own art, when it exists, is not covered by this decision, as charter decision 18 keeps box art separate.
- A rename ([branding.md](../branding.md)) doesn't change the licence; attribution names the project by its canonical name at the time.

## Supersedes / superseded by

None.
