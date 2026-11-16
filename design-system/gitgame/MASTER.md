# Git Game design system: MASTER

_Status: Proposed, awaiting review · 2026-11-16_

The source of truth for the redesign. A page-specific file under `pages/` would override this one; none exist yet.
It was made with the vendored UI/UX Pro Max skill (`.claude/skills/ui-ux-pro-max/`), but the skill's colour, font and
style picks are suggestions only. **Git Game already has a visual identity, and the theme is derived from it.** Each
token below says where it came from.

The prototype is `design-system/gitgame/preview.html` (open it directly; it loads nothing from the network).

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

## 3. The template

### Layouts

**A. Site page** (landing, /git, /teach, /teams, /new-to-git, legal)

```
┌ site header ─────────────────────────────────┐  phone: [$ Git Game]  ……  [menu ▾] [play]
│                                              │  ≥ 900 px: brand · links inline · [play]
├──────────────────────────────────────────────┤
│  $ h1 (mono)                                 │  column: 68ch prose measure, 960 px for the landing's grids
│  lede (sans, muted)                          │
│  # h2 (mono) …  prose · transcript · callouts │
├──────────────────────────────────────────────┤
│ site footer: name · links · trademark notice │
└──────────────────────────────────────────────┘
```

- The header is a single 56 px row at every width. On phones the six links go into a `menu` disclosure (a
  `<details>`, no script) that drops a panel under the header. "play" always stays visible as the primary button.
- Prose is capped at 68ch. Code and transcripts may use the full column.

**B. App entry** (start, room). A phone column (max 480 px, 640 px from 600 px wide). Identity line, `$ Git Game`,
the two primary actions, then **your games** and **settings rows**. A settings row is a full-width disclosure with a
title, a one-line description, a chevron and a surface. The legal foot sits at the bottom.

**C. The game.** Unchanged in structure, because event-screens §4 and §9 specify it: a **status bar** (day, `main`
count, ops left, scores, table), a body, and a **sticky action bar** at the thumb. From 1000 × 560 px the table is a
panel beside the hub. Only the components inside it change.

**D. Maintainer** (stats). Single column of panels. Only tokens and the axis text change.

### Shared components

| Component                  | Rules                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Button**                 | Primary (accent fill, `--on-accent` label), secondary (surface fill, `--field-line` border), quiet (no fill, link colour), link-button. 48 px high (44 px minimum), 8 px gaps. Disabled: a dashed border and `--muted` label, not opacity. **Pending** (e.g. waiting for a second seat): the label is a status line _above_ the button, and the button reads what it will do.                                                                                                                                                                                                                                                                                                                          |
| **Settings row**           | `<details>` styled as a surface row: title, one-line description, chevron that turns. It opens in place. The descriptions in the prototype ("when your pack is due", "bots, people at this device, day length") are **new copy** for you to approve; every other string there is the game's own.                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Field**                  | 44 px, `--field-line` border (≥ 3:1), visible label above it (never placeholder-only), error under the field in `--reject`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Surface**                | `--paper` on `--ground`, 1 px `--line` border, `--r-lg` radius. Used for panels, games list rows, table seats and stat panels.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Callout**                | Guide (ok-soft and ok border), nudge (warn rule), incident (warn band with `--on-band` label), note (muted). Label in mono caps 12 px.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Chip**                   | Score delta, pointer (you, other), status. Minimum 12 px, `--r-pill`, tinted fill with a text colour that passes on that fill.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Playing card**           | As printed: band, file in mono, big `+N`, BUG tag. **Band and BUG text are dark (`--on-band`)** on fixed fills, so every deck colour passes. The band is 20 px (22 px on `lg`). Its word shows only from the `lg` card (96 px) up, and smaller cards keep the colour band without a word. The BUG tag sits in the band's right end on small cards, and under the band, top left, on `lg` cards. File names are 12 px minimum and never break inside a word. **On phones the hand is four cards across the column (about 80 px each), not 64 px.** The face-down hash shows only from `lg` up and is decorative (`aria-hidden`). Card labels never rotate: the wide-screen hand overlaps upright cards. |
| **Transcript**             | Always dark in both themes, with its own `--term-*` semantic colours. Mono 13–14 px, `pre-wrap`, never side-scrolls the page.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Main strip**             | As now. Labels under each slot (file, +N, author) are at least 12 px. Pointer chips are at least 12 px.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Data table**             | Scoreboard and stats: mono numerals, right-aligned, rows 36 px, the total row ruled.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Site header and footer** | One per family A page, generated once (the footer already is, by `vite.config.js`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

---

## 4. Colour tokens

Names stay the ones `styles.css` already uses, so the rollout changes values, not call sites. **New** tokens are marked.

### Where the palette comes from

- **Teal `#3EC1B3`**: the logo's branch (`icon.svg`) and the `auth.js` file colour (`rules/deck.json`). This is
  `--accent`.
- **Violet `#A88BFA`**: the logo's commit and the `api.py` colour. A deck colour only, never a UI role, so a card never
  reads as a player.
- **Coral, blue and amber** (`#F2755C`, `#4C9BE8`, `#E9A83B`): deck file colours. Untouched, because they are rules data
  and the printed deck.
- **Near-black ground, warm paper light ground, pink "you", grey-blue "other", red, green and amber semantics**: the
  existing `styles.css`, per event-screens §4. Light values are darkened just enough to pass.

### Dark (default)

| Token                                                         | Value                                                     | Was                   | Source / reason                                                                                                                                                                           |
| ------------------------------------------------------------- | --------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--ground`                                                    | `#14181c`                                                 | same                  | existing                                                                                                                                                                                  |
| `--ground-2`                                                  | `#1c2227`                                                 | same                  | existing                                                                                                                                                                                  |
| `--paper`                                                     | `#252c33`                                                 | same                  | existing                                                                                                                                                                                  |
| `--ink`                                                       | `#e7ecef`                                                 | same                  | existing                                                                                                                                                                                  |
| `--muted`                                                     | `#a7b3bc`                                                 | `#a0adb7`             | a small nudge for more margin on `--paper`                                                                                                                                                |
| `--line`                                                      | `#343e47`                                                 | same                  | decorative dividers only                                                                                                                                                                  |
| `--field-line` **new**                                        | `#7d8a95`                                                 | n/a                   | input and secondary-button borders, ≥ 3:1 on ground and paper                                                                                                                             |
| `--accent`                                                    | `#3ec1b3`                                                 | same                  | logo teal                                                                                                                                                                                 |
| `--on-accent` **new**                                         | `#0b1a18`                                                 | `var(--ground)`       | primary label                                                                                                                                                                             |
| `--link` **new**                                              | `#3ec1b3`                                                 | `--accent`            | split out so light mode can darken links alone                                                                                                                                            |
| `--you` / `--you-soft`                                        | `#ff6ac1` / `#3a1d31`                                     | same                  | existing                                                                                                                                                                                  |
| `--other`                                                     | `#a3acbd`                                                 | `#9aa3b5`             | nudged for chips on `--paper`                                                                                                                                                             |
| `--ok` / `--ok-soft`                                          | `#52c98f` / `#16301f`                                     | same                  | existing                                                                                                                                                                                  |
| `--reject` / `--reject-soft`                                  | `#ff7a67` / `#3b1f1a`                                     | `#ff6f5b`             | nudged so the BUG tag's dark label passes                                                                                                                                                 |
| `--warn` / `--warn-soft`                                      | `#eaaa42` / `#34290f`                                     | same                  | existing                                                                                                                                                                                  |
| `--on-band` **new**                                           | `#11161a`                                                 | `#fff`                | text on card bands, the BUG tag and the INCIDENT band, in both themes                                                                                                                     |
| `--bug-fill` / `--incident-fill` **new**                      | `#ff7a67` / `#eaaa42`                                     | `--reject` / `--warn` | the BUG tag and INCIDENT band are printed objects like the deck colours, so their fills stay fixed in both themes (light mode's darker `--reject`/`--warn` would fail under a dark label) |
| `--cmd` / `--on-cmd` **new**                                  | `#3c4955` / `#ffffff`                                     | same / `#fff`         | command card band                                                                                                                                                                         |
| `--faint`                                                     | `#5e6b75`                                                 | same                  | **non-text only** (hatches, unknown band). Text uses `--muted`.                                                                                                                           |
| `--term`, `--term-ink`                                        | `#0d0f12`, `#d8d5ce`                                      | same                  | existing                                                                                                                                                                                  |
| `--term-muted`                                                | `#8d929b`                                                 | `#7d828c`             | `#` comments: more margin (6.14:1)                                                                                                                                                        |
| `--term-ok` / `-reject` / `-warn` / `-you` / `-other` **new** | `#52c98f` / `#ff7a67` / `#eaaa42` / `#ff6ac1` / `#a3acbd` | n/a                   | the dark semantics, fixed, so the terminal is the same in both themes                                                                                                                     |

### Light (`prefers-color-scheme: light`, or `data-theme="light"`)

| Token                        | Value                 | Was                | Note                                                                   |
| ---------------------------- | --------------------- | ------------------ | ---------------------------------------------------------------------- |
| `--ground`                   | `#f3efe7`             | `#eee9df`          | the same warm paper, a step lighter so everything on it gains contrast |
| `--ground-2`                 | `#e9e3d7`             | `#e4ddd0`          |                                                                        |
| `--paper`                    | `#ffffff`             | same               |                                                                        |
| `--ink`                      | `#1b2228`             | same               |                                                                        |
| `--muted`                    | `#525f6a`             | `#5b6975`          |                                                                        |
| `--line`                     | `#d6cfc2`             | `#d3cbbd`          | decorative                                                             |
| `--field-line`               | `#837a6c`             | n/a                |                                                                        |
| `--accent` / `--on-accent`   | `#13756b` / `#ffffff` | `#1d8c80` / ground | the primary label goes from 3.39:1 to 5.55:1                           |
| `--link`                     | `#106a61`             | `#1d8c80`          |                                                                        |
| `--you` / `--you-soft`       | `#b01f70` / `#f8dcec` | `#c4267f`          |                                                                        |
| `--other`                    | `#596173`             | `#6b7385`          |                                                                        |
| `--ok` / `--ok-soft`         | `#1b7449` / `#dcf1e5` | `#23865a`          |                                                                        |
| `--reject` / `--reject-soft` | `#b52f1d` / `#fbe2dd` | `#cf3d29`          |                                                                        |
| `--warn` / `--warn-soft`     | `#865600` / `#faedd2` | `#a86f0c`          |                                                                        |
| `--cmd`                      | `#2f3a44`             | same               |                                                                        |
| terminal tokens              | as dark               |                    | the terminal is dark in both themes                                    |

### Contrast check (WCAG 2.x AA)

Each pair is checked the way the UI actually uses it. **Before: 34 of 70 current pairs fail. After: 0 of 96 (48 per
theme).** The checker and both token sets are in `design-system/gitgame/contrast/`
(`python3 -I contrast.py tokens.json pairs.json`). The key pairs, as it computes them:

| Pair                                          | Dark                             | Light                            |
| --------------------------------------------- | -------------------------------- | -------------------------------- |
| ink on ground / paper                         | 14.99 / 11.87                    | 14.02 / 16.08                    |
| muted on ground / paper                       | 8.34 / 6.60                      | 5.72 / 6.55                      |
| link on ground / paper                        | 8.06 / 6.38                      | 5.62 / 6.45                      |
| on-accent on accent (primary label)           | 8.07                             | 5.55                             |
| you / other / ok / reject / warn on ground    | 6.87 / 7.81 / 8.59 / 6.99 / 8.77 | 5.59 / 5.41 / 5.03 / 5.40 / 5.47 |
| on-band on the five deck colours              | 8.22 / 6.71 / 6.48 / 6.21 / 8.78 | same                             |
| on-band on BUG / INCIDENT fills               | 7.14 / 8.95                      | same                             |
| term-muted / term-reject / term-you on term   | 6.14 / 7.52 / 7.39               | same                             |
| field-line on ground / paper (UI, 3:1)        | 5.05 / 4.00                      | 3.69 / 4.23                      |
| accent focus ring on ground / paper (UI, 3:1) | 8.06 / 6.38                      | 4.84 / 5.55                      |

---

## 5. Type

- **Families: keep the system stacks.** `--sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` and
  `--mono: ui-monospace, "SF Mono", SFMono-Regular, "JetBrains Mono", Menlo, Consolas, monospace`. The skill suggests
  JetBrains Mono + IBM Plex Sans. Loading them from Google Fonts would add a third party that the privacy policy
  doesn't list, and break the PWA offline. Self-hosting them is possible (both are OFL), at about 60–90 kB. **Open
  question for you.**
- **Roles.** Mono is for headings, Git (commands, output, file names, hashes), numerals in data and caps labels. Sans
  is for prose, buttons and coach lines. `font-variant-ligatures: none` stays, so `--force` shows two hyphens.

| Token         | Size / line height | Use                                                        |
| ------------- | ------------------ | ---------------------------------------------------------- |
| `--t-caption` | 12 / 1.4           | Minimum for any readable text: chips, caps labels, footers |
| `--t-small`   | 14 / 1.45          | Secondary lines, transcripts on phones                     |
| `--t-body`    | 16 / 1.5           | Prose, buttons                                             |
| `--t-lede`    | 18 / 1.5           | Ledes, coach lines (`.said`)                               |
| `--t-h2`      | 18–20 / 1.3 mono   | `# ` headings                                              |
| `--t-h1`      | 24 → 28 / 1.2 mono | `$ ` headings (`clamp`)                                    |
| `--t-display` | 28 → 44 / 1.1 mono | Landing hero only                                          |

Caps labels: mono, 12 px, `letter-spacing: 0.08em`, never below 12 px.

---

## 6. Spacing, radius, elevation, motion

- **Spacing** is a 4 px base: `--s-1` 4, `--s-2` 8, `--s-3` 12, `--s-4` 16, `--s-5` 24, `--s-6` 32, `--s-7` 48,
  `--s-8` 64. The page gutter is 16 px on phones and 24 px from 600 px. The gap between touch targets is ≥ 8 px.
- **Radius**: `--r-sm` 6 (transcript, chips), `--r-md` 10 (fields, buttons), `--r-lg` 14 (surfaces, today's `--r`),
  `--r-pill` 999. Cards keep their own proportional radius.
- **Elevation**: flat. One `--shadow` for cards and sheets only, as now.
- **Motion** (from event-screens §4 and the skill's timing rules):
  `--dur-1` 120 ms (press, hover), `--dur-2` 200 ms (disclosure, chips), `--dur-3` 400 ms (card moves; the spec's
  300–600 ms), `--ease` `cubic-bezier(.2,.8,.2,1)` (existing), `--ease-exit` `cubic-bezier(.4,0,1,1)` (exits faster than
  entries). One or two things move per view. `prefers-reduced-motion: reduce` makes all of it instant, as today, and
  the guide's beckon becomes a steady outline.
- **Focus**: 3 px `--accent` outline with a 2 px offset on every interactive element. It is never removed.

---

## 7. Acceptance rules for every phase

- Each phase keeps `npm run format:check`, `npm test` (198 passing, 1 skipped at baseline) and `npm run build` green.
- No horizontal page scroll at 375, 768, 1024 or 1440 px. Only the `main` strip scrolls sideways.
- An automated scan reads the computed colour of every visible text node against its effective background, in both
  themes, on every page and game screen. It must find 0 below 4.5:1 (3:1 for ≥ 24 px, or ≥ 18.66 px bold).
- No readable text under 12 px. No placeholder-only labels. No rotated labels.
- Only data the product has: every string and number on a screen comes from the remote's view, `copy.js`, or the
  page's own HTML.

---

## 8. Rollout order

Each phase is one commit (or a few) on `claude/ui-ux-redesign`.

1. **Tokens.** Put the values above into `styles.css`. Add `--on-accent`, `--link`, `--field-line`, `--on-band`,
   `--on-cmd`, `--term-*`, and the spacing, radius, type and motion scales. Replace raw `#fff` and `--faint`-as-text.
   Fix `theme-color` and the manifest. Contrast is fixed everywhere by this phase alone.
2. **Shared components.** Buttons (with disabled and pending states), fields, settings rows, callouts, chips, cards
   (band and BUG on `--on-band`, size floors, no rotated hand), the transcript on `--term-*`, the site header (phone
   menu) and the footer.
3. **Family A, site pages.** `landing.css` and `pages.css` on the new header, measure and type scale.
4. **Family B, app entry.** Start (settings rows, games list rows), room (the pending state), email reminders.
5. **Family C, the game.** Status bar, hub (slots, actions, `.will`), main strip labels, table sheet and panel, moments
   and playback, receipt, release and scoreboard, replay.
6. **Family D, stats.** Axis text and panels.
7. **Verification.** Screenshots at 375, 768, 1024 and 1440 px in light and dark across all four families, plus the
   automated contrast scan.

Out of scope unless asked: the link-preview image (`web/public/og.png`, drawn by `scripts/og-image.sh`), the
print-and-play deck, and the prototypes under `prototypes/`.
