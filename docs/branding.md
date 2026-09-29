# Branding: the name is not final

*Status: Current · Last verified: 2026-09-29*

The working name is **Git Game** and the domain is **gitgame.online**. NeuEra LLC owns the domain. Permission to use the name was requested from the Git trademark holder (Software Freedom Conservancy) on 2026-09-29; we proceed on the assumption that it will be fine, but there is a small chance the project will need a different name. This document makes that a one-afternoon change instead of a month-long one.

## 1. Canonical spellings

The name appears in exactly three forms, chosen by context. No others exist.

| Form | Where | Example |
|---|---|---|
| `Git Game` | Prose, UI text, titles | "Welcome to Git Game" |
| `GitGame` | Code identifiers, module namespaces | `GitGame.Remote`, `<GitGameTerminal>` |
| `gitgame` | Slugs, package names, the domain, URLs, env prefixes | `gitgame.online`, `GITGAME_ENV` |

Not used: `Gitgame`, `git-game`, `git_game`, `GITGAME` (except as an env-var prefix), `GG`. If you find one, fix it. <!-- brand-audit: ignore -->

## 2. One source of truth per codebase

User-facing strings never hard-code the name. Each codebase has exactly one place that defines it, marked with the token `BRAND` in a comment so it is trivial to find:

- Server: a `Brand` module (`GitGame.Brand.name/0`, `domain/0`) — `# BRAND`
- Web: `web/src/brand.js` exporting `name`, `domain` — `// BRAND`
- Rules data: a `brand` key at the top of the rules config — `# BRAND`
- Docs and templates: use the name directly (they are prose), but only in canonical spellings.

Everything else reads from those. Module namespaces (`GitGame.*`) are the accepted exception: renaming them is a mechanical search-and-replace, made safe by rule 1.

## 3. The audit

`scripts/brand-audit.sh` lists every occurrence of the name in the repository and fails if it finds a non-canonical spelling. A line that must quote a wrong spelling on purpose (like the list above) carries the marker `brand-audit: ignore`. It runs at every gardening pass and can run any time:

```
scripts/brand-audit.sh
```

## 4. If the name changes

1. Decide the three new forms and update the table above.
2. Change the `BRAND`-marked definitions.
3. Run the audit; replace every listed occurrence, in this order: docs, rules data, code identifiers, package names, then the domain and any external accounts.
4. Update this document's history section below, and the README notice.
5. Write an ADR recording the change and the reason.

## History

- 2026-09-29 — Working name "Git Game" adopted; trademark permission requested.
