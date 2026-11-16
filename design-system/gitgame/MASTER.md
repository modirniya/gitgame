# Git Game design system: MASTER

_Status: Approved and rolled out (Studio) · 2026-11-16_

The source of truth for the redesign. A page-specific file under `pages/` would override this one; none exist yet.
It was made with the vendored UI/UX Pro Max skill (`.claude/skills/ui-ux-pro-max/`), but the skill's colour, font and
style picks are suggestions only. **Git Game already has a visual identity, and the theme is derived from it.** Each
token below says where it came from.

The prototype is `design-system/gitgame/preview.html`: part 1 is the four screen families, part 2 is all 30 elements
in every state. `themes.html` keeps the five directions that were compared. Both open directly and load nothing from
the network.

**Decision log**

- 2026-11-16: five directions compared in `themes.html` (Terminal, Commit violet, Tabletop, Phosphor/Printout,
  Studio). **Studio chosen.** It changes one thing §1 listed under "keep": headings become sans, and the `$ ` / `# `
  prompts stay only where Git speaks (moments, Git's output, the hub's commands). The logo, the deck, the semantic
  colours, the always-dark terminal and mono for Git all stay.

---

## 1. What the review found

### What Git Game is

An asynchronous multiplayer card game whose rules are Git. The client (`web/`) is Vite, plain ES modules, no framework,
a PWA. The server (`server/`) is Phoenix. There is no Tailwind, no component library and no web fonts. The look lives
in hand-written CSS: `web/src/styles.css` (tokens, both themes) plus `cards`, `table`, `frame`, `hub`, `playback`,
`release`, `landing`, `pages` and `stats.css`.

### How it was reviewed

The real app was built and run: the server in its pinned Elixir image against Postgres, the client on Vite. Every
static page was screenshotted at 390 and 1280 px in dark and light. A real game against the bot was driven to its
release, through the guided hub, the table sheet, day playback, the day receipt, the release and scoreboard, a replay,
the start screen with a finished game, and a room.

### The screen families

| Family            | Screens                                                                                                                                   | Shell                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **A. Site pages** | `/` landing; `/git` door and its 10 pages; `/teach`, `/teams`, `/new-to-git`; `/privacy`, `/terms`                                        | Site header, single prose column, site footer                                         |
| **B. App entry**  | `/play` start (with games, reminders, set-up-by-hand); room `#/room/<code>`                                                               | Phone column, no header                                                               |
| **C. The game**   | Incident and draws; hub (write a pack); table sheet or panel; day playback (moments); day receipt; release and scoreboard; replay `#/r/…` | Status bar on top, sticky action bar at the bottom; two panes from about 1000 px wide |
| **D. Maintainer** | `/stats` pulse                                                                                                                            | Single column of panels with bar charts                                               |

### What is already right (keep it)

- **A real identity.** The logo (`web/public/icon.svg`) is a teal branch with a violet commit on a near-black tile. The
  deck (`rules/deck.json`) gives five file colours. The headings are a terminal: `$ ` before an `h1`, `# ` before an
  `h2`, in monospace. Prose is sans and Git is monospace. That split is charter decision 14 and event-screens §4.
- Semantic colours mean one thing each: red is a rejection or a bug, green is accepted, amber is a warning. Your colour
  is pink and everyone else's is grey-blue, kept outside the deck's file palette.
- Touch targets are already 44–48 px. Reduced motion is respected. There is no horizontal page scroll at 390 px
  (checked on every page).
- Two themes from one set of tokens, following the OS.

### Problems shared across families

1. **Light mode fails contrast throughout (AA).** Links and the primary button's label, `--accent` #1d8c80 on #eee9df,
   are 3.39:1. ok, reject, warn, other and you text on the ground are 3.5–4.4:1. 34 of 70 checked pairs fail across
   both themes (see §4). The
   primary button is the most-tapped thing in the game.
2. **The terminal ignores the theme, but its colours don't.** The transcript is always dark, yet in light mode it is
   drawn with light-mode semantic colours. Reject on the terminal is 3.98:1, you 3.59:1, ok 4.23:1.
3. **White text on bright fills.** The card bands (white on the five deck colours, 2.07–2.93:1), the BUG tag (2.74:1)
   and the INCIDENT band (2.03:1) all fail in both themes.
4. **Text too small to read.** Card bands scale with the card, so the band label is about 5.6 px on a 64 px strip card.
   The hash on a face-down commit is about 6 px. Labels such as "initial commit", pointer chips and `.action .will`
   (10.4 px) are 8–10 px. The skill's floor is 12 px for anything that must be read.
5. **The phone site header takes 130–170 px and wraps unpredictably.** Six text links and the play button wrap onto two
   or three rows, leaving "play" on a line of its own. The same header is used on 16 pages.
6. **Disclosures look like plain text.** On the start screen, "reminders by email" and "more: set up a game by hand"
   are `<details>` with no marker, no surface and big gaps. They read as stray captions, not controls.
7. **States are drawn with opacity.** Disabled controls are 42% opacity, so "git add / select cards in your hand" and
   the room's "waiting for a second seat" are low contrast and look broken rather than waiting. A status the player must
   read is drawn as a disabled button.
8. **Faint text.** `--faint` (#5e6b75 dark, #a7b1ba light) is used for text ("empty" in the hub's staged and to-push
   slots, and the stats axis) at 1.8–3.3:1.
9. **Input borders are invisible.** `--line` on the ground is 1.64:1 (dark) and 1.33:1 (light). Form fields have no
   3:1 boundary.
10. **Rotated card labels on wide screens.** At 1280 px the hand fans with file names set vertically ("api.py",
    "README.md"). They are hard to read and unlike the printed card.
11. **Drift.** Seven radii (4, 6, 10, 12, 14, 16 px and pills), ad-hoc spacing, raw `#fff` in several files, and
    `theme-color` #14161a while the ground is #14181c.

---

## 2. The skill's input, and what was taken from it

| Search                                                                                                                   | Result                                                                                                                                                                                                                               | Used?                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--design-system "multiplayer card game developer terminal education"`                                                   | Style "3D & Hyperrealism", felt green and gold on navy, JetBrains Mono everywhere                                                                                                                                                    | **No.** It conflicts with itself (its own anti-patterns say "avoid 3D effects") and with the existing identity. The mono-heading direction confirms the current one. |
| `--design-system "developer tool terminal minimal dark" --variance 3 --motion 3 --density 6`                             | Minimalism & Swiss Style: clean, high contrast, functional; code-dark and run-green                                                                                                                                                  | **Style yes**, as the frame around the cards: flat surfaces, one accent, no gradients or glass. Its palette, no.                                                     |
| `--domain typography "monospace code readable"`                                                                          | "Developer Mono": JetBrains Mono + IBM Plex Sans; "Dashboard Data": Fira Code + Fira Sans                                                                                                                                            | **Pairing principle yes** (mono for code and headings, sans for prose, as today). Web fonts: see §5 and the open question.                                           |
| `--domain product "card game turn based"`                                                                                | Card & Board Game → 3D & Hyperrealism + Flat                                                                                                                                                                                         | Flat only.                                                                                                                                                           |
| `--domain ux` touch target, reduced motion, focus visible, contrast, sticky nav, readable size, line height, text reflow | 44 px targets and 8 px gaps; respect `prefers-reduced-motion`; animate 1–2 things per view; never remove focus rings; 4.5:1 text; fixed nav must not cover content; 16 px body; line height 1.5–1.75; never clip text in fixed boxes | **Yes**, all of them. They are the acceptance rules in §7.                                                                                                           |
| `--stack html-tailwind` dark mode, containers                                                                            | Tailwind `dark:` classes, container queries                                                                                                                                                                                          | **Not applicable.** No Tailwind here. The principle (test either side of each breakpoint) is kept.                                                                   |

---

## 3. The template (Studio)

### Layouts

**A. Site page** (landing, /git, /teach, /teams, /new-to-git, legal)

```
┌ site header (60 px) ───────────────────────────────┐  phone: [logo Git Game] …… [menu ▾] [play]
│                                                    │  header ≥ 640 px: logo · link pills · [play]
├────────────────────────────────────────────────────┤
│  h1 (sans 700)                                     │  68ch prose measure; 960 px for the landing's grids
│  lede (18 px, muted)                               │
│  h2 … prose · transcript ($ kept there) · callouts │
├────────────────────────────────────────────────────┤
│ site footer: name · links · trademark notice       │
└────────────────────────────────────────────────────┘
```

- One 60 px row at every width. Under 640 px of header the links fold into a `menu` disclosure, a raised panel under
  the header. "play" always stays visible. Under 300 px the wordmark folds too, and the logo stays.
- The current page is a soft accent pill (`aria-current="page"`).

**B. App entry** (start, room). A phone column (max 480 px, 640 px from 600 px wide): who you are, `Git Game`, the two
primary actions, **your games** as tappable rows, then **settings rows**.

**C. The game.** Unchanged in structure (event-screens §4 and §9): status bar, body, sticky action bar, and from
1000 × 560 px the table as a panel beside the hub. Inside it, every element follows part 2 of the prototype.

**D. Maintainer** (stats). KPI tiles, a segmented period switch, panels with bars.

### Element review

Every element the client uses was redrawn in each of its states and checked against §7, in both themes. That is 30
elements, each with its own card in part 2 of `preview.html`, which lists what changed and why.

| #   | Element                 | States covered                                                                   | What changed                                                                                                                     |
| --- | ----------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 01  | Brand                   | default, focus                                                                   | Logo `icon.svg` at 28 px + sans wordmark; the `$` moves to Git                                                                   |
| 02  | Site header             | wide, current page, hover, narrow, menu open                                     | One 60 px row; links fold into "menu" under 640 px; current-page pill                                                            |
| 03  | Button                  | primary/secondary × default, hover, focus, pressed; disabled, busy, quiet, small | Pills; hover is a fill; pressed scales 0.97 (no layout shift); disabled dashed, not faded; **busy** with spinner and `aria-busy` |
| 04  | Text link               | default, hover, focus, on tint                                                   | Always underlined; 44 px hit area when standalone                                                                                |
| 05  | Settings row            | closed, hover, focus, open (email form)                                          | Surface row with title, description, turning chevron (**new copy**)                                                              |
| 06  | Text field              | empty, hover, focus, error, read-only + action, disabled                         | 48 px, 3:1 border, label above; error is 2 px red border + message via `aria-describedby`; copy confirms with a check (**new**)  |
| 07  | Select                  | default, focus                                                                   | Native, restyled, drawn chevron, padding so options never run under it                                                           |
| 08  | Checkbox                | off, on, focus                                                                   | 22 px box in a 44 px row; whole label toggles                                                                                    |
| 09  | Feedback box            | empty, written, sent                                                             | Tabular counter; "send" turns primary once there is text                                                                         |
| 10  | Your games              | due, waiting, finished, hover                                                    | Whole row is the link; state told by dot, colour and words; finished games no longer faded                                       |
| 11  | Messages                | note, error, waiting                                                             | Error panel with icon; waiting is a status line with a pulsing dot                                                               |
| 12  | Chips                   | you, other, ok, warn, reject                                                     | 26 px pills, 12 px, true minus sign                                                                                              |
| 13  | Guide and nudge         | guide step, nudge                                                                | Guide gains a 10-step progress bar; 1 px tinted panels                                                                           |
| 14  | Incident                | default                                                                          | Fixed amber band, dark label (8.95:1, was 2.03:1)                                                                                |
| 15  | Playing card            | kinds, sizes, hand: default, hover, picked, focus                                | Dark band text; BUG on the band; picked = lift + ring + check + `aria-pressed`; names break only before the extension            |
| 16  | Main strip              | root, face-down, tip, your push waiting                                          | 12 px labels (were 8–9 px); tip is a neutral pill (red means rejected)                                                           |
| 17  | Your branch             | empty, staged                                                                    | "empty" at 4.5:1 (was 2.2–2.6:1); filled pile turns solid                                                                        |
| 18  | Action tile             | ready (with what it will write), hover, pressed, focus, disabled with reason     | Reason at full contrast (was 42% opacity); `.will` 12 px (was 10.4)                                                              |
| 19  | Status bar and progress | ops left, op spent, playing back                                                 | Sans tabular 14 px; spent op is a ring; named for screen readers; wraps on 320 px phones                                         |
| 20  | Action bar              | hub, playback, end of game                                                       | Primary always right and widest; above the safe area                                                                             |
| 21  | Transcript              | output, landed, rejected, comment                                                | `--term-*` colours; tone as a 4 px edge, not colour alone                                                                        |
| 22  | Moment                  | landed, rejected                                                                 | 24 px mono command with `$`, coloured by outcome                                                                                 |
| 23  | Bot's step              | avatar, op dots, bubble                                                          | Bubble points at the avatar; op count written out too                                                                            |
| 24  | Receipt                 | ran, landed, lost                                                                | Marks are icons from one family, with names                                                                                      |
| 25  | Scoreboard              | rows, total, verdict                                                             | Real table with `scope`; tabular numbers; ruled total                                                                            |
| 26  | Replay navigation       | first day, middle, focus                                                         | 48 px named icon buttons; disabled at the ends, not hidden                                                                       |
| 27  | Table sheet and seats   | writing, pack sent                                                               | Grab handle, named close; seat state as chips with words; focus kept inside (**new**)                                            |
| 28  | Questions (landing)     | closed, open                                                                     | 56 px rows, plus turns to ×                                                                                                      |
| 29  | Period switch (stats)   | selected, focus                                                                  | One segmented control with `aria-pressed` (was three buttons)                                                                    |
| 30  | Who you are             | anonymous, linked                                                                | Mono handle; "sign out" gets a 44 px target                                                                                      |

**Icons.** One family, drawn for this: a 24-unit grid, 2 px round strokes, 20 px on screen (chevrons, arrows, check,
plus, ×, copy, alert, dot). Decorative ones are `aria-hidden`; meaningful ones are named. There are no emoji and no icon
font.

**How it was checked.** `contrast/audit.js` loads a page at a width and theme and fails on any target under 44 px
(24 px for links outside prose), any text under 12 px, any clipped label, a sideways page scroll, or a focusable element
without a ring. `contrast/scan-contrast.js` checks every visible text node against its real background. On the
prototype, at 320, 375, 768, 1024 and 1440 px in dark and light, both report 0 findings. The audit's first run found
undersized "link GitHub" and copy buttons, file names clipped on 65 px hand cards, and sideways scrolls at 320 and
375 px. All were fixed in the element specs above.

---

## 4. Colour tokens (Studio)

Names stay the ones `styles.css` already uses where they exist, so the rollout changes values, not call sites.

### Where the palette comes from

- **Teal**: the logo's branch (`#3EC1B3`), softened to `#5CD6C8` at night and deepened to `#0F7168` by day.
- **Cool slate grounds** replace warm paper and grey-green: Studio's choice, a neutral that lets the deck colours and
  the teal carry the colour.
- **Deck colours** (`rules/deck.json`), the **BUG** and **INCIDENT** fills, `--on-band` and the **terminal** tokens are
  the same as in the earlier proposal: fixed in both themes.
- **Semantics** keep their meanings and hues (pink you, grey-blue others, red, green, amber), tuned for the new grounds.

| Token             | Dark      | Light     | Today (dark / light)  |
| ----------------- | --------- | --------- | --------------------- |
| `--ground`        | `#151a22` | `#f3f6f9` | `#14181c` / `#eee9df` |
| `--ground-2`      | `#1b222c` | `#e8edf2` | `#1c2227` / `#e4ddd0` |
| `--ground-raised` | `#1b222c` | `#ffffff` | **new**               |
| `--paper`         | `#232b37` | `#ffffff` | `#252c33` / `#ffffff` |
| `--paper-hover`   | `#2b3442` | `#eef3f7` | **new**               |
| `--ink`           | `#eef2f7` | `#18202b` | `#e7ecef` / `#1b2228` |
| `--muted`         | `#a9b4c4` | `#4f5b6b` | `#a0adb7` / `#5b6975` |
| `--line`          | `#323c4b` | `#d5dde6` | `#343e47` / `#d3cbbd` |
| `--field-line`    | `#8492a6` | `#7b8796` | **new**               |
| `--accent`        | `#5cd6c8` | `#0f7168` | `#3ec1b3` / `#1d8c80` |
| `--accent-hover`  | `#7fe1d6` | `#0c5f57` | **new**               |
| `--accent-press`  | `#49c4b6` | `#0a5049` | **new**               |
| `--accent-soft`   | `#123735` | `#dcf2ef` | **new**               |
| `--on-accent`     | `#06201d` | `#ffffff` | **new**               |
| `--link`          | `#6fdcd0` | `#0d665e` | **new**               |
| `--you`           | `#ff7cc8` | `#b01f70` | `#ff6ac1` / `#c4267f` |
| `--you-soft`      | `#3b1d33` | `#f8dcec` | `#3a1d31` / `#f8dcec` |
| `--other`         | `#a8b3c6` | `#566073` | `#9aa3b5` / `#6b7385` |
| `--other-soft`    | `#28303d` | `#e4e8ef` | `#262d38` / `#e3e6ee` |
| `--ok`            | `#5fd39b` | `#1b7449` | `#52c98f` / `#23865a` |
| `--ok-soft`       | `#163126` | `#dcf1e5` | `#16301f` / `#dcf1e5` |
| `--reject`        | `#ff8473` | `#b52f1d` | `#ff6f5b` / `#cf3d29` |
| `--reject-soft`   | `#3d2220` | `#fbe2dd` | `#3b1f1a` / `#fbe2dd` |
| `--warn`          | `#efb24f` | `#865600` | `#eaaa42` / `#a86f0c` |
| `--warn-soft`     | `#372b14` | `#faedd2` | `#34290f` / `#faedd2` |
| `--cmd`           | `#3a4657` | `#2c3644` | `#3c4955` / `#2f3a44` |
| `--term`          | `#0e1218` | `#0e1218` | `#0d0f12` / `#0d0f12` |

Fixed in both themes: `--on-band` `#11161a`, `--bug-fill` `#ff7a67`, `--incident-fill` `#eaaa42`, `--on-cmd`
`#ffffff`, `--term-ink` `#d8d5ce`, `--term-muted` `#8d929b`, `--term-ok` `#52c98f`, `--term-reject` `#ff7a67`,
`--term-warn` `#eaaa42`, `--term-you` `#ff6ac1`, `--term-other` `#a3acbd`. `--faint` is for non-text only.

### Contrast check (WCAG 2.x AA)

68 pairs per theme, 136 in all, including hover, pressed and selected states. **0 fail** (today's tokens: 34 of 70
fail). Reproduce it with `python3 -I contrast.py studio.json studio-pairs.json`. Key pairs:

| Pair                                                      | Dark                             | Light                            |
| --------------------------------------------------------- | -------------------------------- | -------------------------------- |
| ink on ground / paper                                     | 15.53 / 12.69                    | 15.12 / 16.40                    |
| muted on ground / paper                                   | 8.32 / 6.80                      | 6.37 / 6.91                      |
| link on ground / paper                                    | 10.66 / 8.71                     | 6.29 / 6.82                      |
| on-accent on accent / hover / pressed                     | 9.66 / 11.07 / 8.00              | 5.86 / 7.53 / 9.31               |
| ink on paper-hover / accent-soft (hover, selected)        | 11.17 / 11.50                    | 14.68 / 14.05                    |
| you / other / ok / reject / warn on ground                | 7.46 / 8.25 / 9.38 / 7.32 / 9.27 | 5.91 / 5.84 / 5.32 / 5.71 / 5.79 |
| you / other / ok / warn / reject chips on their soft fill | 6.36 / 6.28 / 7.51 / 7.35 / 6.08 | 5.02 / 5.15 / 4.88 / 5.41 / 5.02 |
| on-band on BUG / INCIDENT fills                           | 7.14 / 8.95                      | 7.14 / 8.95                      |
| field-line on ground / paper (UI, 3:1)                    | 5.52 / 4.51                      | 3.37 / 3.65                      |
| accent ring on ground / paper / accent-soft (UI, 3:1)     | 9.90 / 8.09 / 7.33               | 5.40 / 5.86 / 5.02               |

---

## 5. Type (Studio)

- **Families:** the system stacks, unchanged (`--sans`: system-ui …; `--mono`: ui-monospace … JetBrains Mono …). Web
  fonts remain an open question (§9).
- **Roles.** Sans is for headings, prose, buttons, labels and numbers. Mono is only for what Git says or names:
  commands, output, file names, hashes, handles, and `#` comments. The `$` prompt appears only before a command.
  `font-variant-ligatures: none` stays.
- **Numbers** use `font-variant-numeric: tabular-nums` wherever they change (status bar, scores, counters, stats).

| Token         | Size / line height | Use                                                    |
| ------------- | ------------------ | ------------------------------------------------------ |
| `--t-caption` | 12 / 1.4           | Minimum for readable text: chips, labels, footers      |
| `--t-small`   | 14 / 1.45          | Secondary lines, transcripts, status bar               |
| `--t-body`    | 16 / 1.5           | Prose, buttons                                         |
| `--t-lede`    | 18 / 1.5           | Ledes, coach lines                                     |
| `--t-h3`      | 17 / 1.3           | Card and section titles                                |
| `--t-h2`      | 20 / 1.25          | Section headings                                       |
| `--t-h1`      | 26 → 32 / 1.15     | Page and screen titles (`clamp`), letter-spacing −1.5% |
| `--t-display` | 32 → 44 / 1.1      | Landing hero only                                      |

Labels: sans 600, 12 px, uppercase, `letter-spacing: 0.06em`. Headings and setting titles use sentence case ("Your
games", "Day 1 closed"); buttons keep the game's lowercase ("play the bot now"). **The casing is a copy change for you
to approve.**

---

## 6. Spacing, shape, elevation, motion (Studio)

- **Spacing**: 4 px base (`--s-1` 4 … `--s-8` 64). Page gutter 16 px on phones, 24 px from 600 px. ≥ 8 px between
  targets.
- **Radius**: `--r-sm` 8 (inline code, small badges), `--r-md` 12 (fields, tiles, transcript), `--r-lg` 20 (surfaces,
  sheets), `--r-pill` (buttons, chips, segmented control). Cards: 8 / 10 / 12 px at sm / md / lg.
- **Elevation**: `--shadow-1` (surfaces, rows, cards) and `--shadow-2` (hover lift, picked card, incident, menus,
  sheets). Dark mode uses darker, tighter shadows.
- **Motion**: `--dur-1` 120 ms (hover, press), `--dur-2` 200 ms (chevrons, lifts), `--dur-3` 400 ms (card moves, the
  playback bar), `--ease` and `--ease-exit` as before. Pressed is a transform (never a layout change). Reduced motion
  makes everything instant; the pending dot and spinner hold still.
- **Focus**: a 3 px `--accent` ring, 2 px offset (fields use an inset 3 px ring with an accent border). Never removed.

---

## 7. Acceptance rules for every phase

- Each phase keeps `npm run format:check`, `npm test` (198 passing, 1 skipped at baseline) and `npm run build` green.
- `contrast/audit.js` and `contrast/scan-contrast.js` report 0 findings on every page and game screen at 375, 768,
  1024 and 1440 px (and 320 px for the phone screens), in dark and light.
- Only the `main` strip scrolls sideways. No rotated labels. No placeholder-only labels.
- Only data the product has: every string and number comes from the remote's view, `copy.js`, or the page's own HTML.
  New copy is listed in §9 and needs your approval first.

---

## 8. Rollout order

Each phase is one commit (or a few) on `claude/ui-ux-redesign`.

1. **Tokens.** The Studio values into `styles.css` (both themes), the new state tokens, the type, radius, shadow and
   motion scales; replace raw `#fff`, `--faint` as text, and the `theme-color` / manifest colours.
2. **Shared components.** Elements 01–09, 11–15 and 21: the icon sprite, buttons with busy and disabled states,
   fields, settings rows, chips, callouts, the card, the transcript, the site header (menu) and the footer.
3. **Family A, site pages.** `landing.css`, `pages.css`: sans headings, the header, the measure, the questions.
4. **Family B, app entry.** Start, your games, reminders, the room's waiting state, who you are.
5. **Family C, the game.** Elements 16–20 and 22–27: strip, branch, action tiles, status bar, action bar, moments, the
   bot's step, receipt, scoreboard, replay, table sheet and panel.
6. **Family D, stats.** KPI tiles, the segmented switch, the bars.
7. **Verification.** Screenshots at 375, 768, 1024 and 1440 px in light and dark across all four families, and both
   scans on the live app.

Out of scope unless asked: the print-and-play deck, `prototypes/`. The link-preview image (`web/public/og.png`) was redrawn in Studio afterwards, from `scripts/og-image.html`.

---

## 9. Decisions (approved 2026-11-16)

1. **Copy changes**: approved. Headings and setting titles in sentence case ("Your games", "Day 1 closed", "Room …",
   "The table", "Pulse"); the two settings-row descriptions; the copy button's "copied".
2. **Web fonts**: the system stacks, as proposed.
3. **Theme switch**: none for now; the site follows the OS, as before. `data-theme="dark"` still forces dark.

---

## 10. Rollout record

| Phase                | Commit        | What changed                                                                                                                                                |
| -------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Tokens            | `499a8de`     | Studio colours, state tokens, scales, the terminal's own colours, theme-color per OS theme                                                                  |
| 2. Shared components | `6c2a944`     | Type, buttons, fields, settings rows, chips, cards, transcript, site header and menu                                                                        |
| 3. Site pages        | `e45dee4`     | Landing, /git, /teach, /teams, /new-to-git, legal pages                                                                                                     |
| 4. App entry         | `f8f5e06`     | Start, your games, reminders, busy buttons, room waiting state and copy button                                                                              |
| 5. The game          | `62abc12`     | Status bar, strip, branch, actions, pack, table, playback, receipt, scoreboard, replay, guide                                                               |
| 6. Stats             | `5077987`     | Tiles, segmented switch, charts                                                                                                                             |
| 7. Verification      | `this commit` | `contrast/scan-site.js` at 375, 768, 1024 and 1440 px in dark and light: 220 screens, **0 findings** (contrast, text under 12 px, targets, sideways scroll) |

Where the implementation refined the spec:

- **The laptop hand** no longer fans closer than 88 px a card: it takes another row instead, so no label is ever
  turned on its side (`hub.js` `fanLayout`; its tests now state that rule).
- **Band words** show from a 90 px card up (the phone hand's 79 px cards show the colour alone), and a file name too
  long for its card breaks only before its extension (`cards.js` puts a `<wbr>` there).
- **The screen body** no longer lets a flex child shrink, which had been squeezing transcripts once type grew.
- The header's menu closes on Escape and outside taps via `src/menu.js`, bundled into every site page by a `pre`
  transform in `vite.config.js`.
