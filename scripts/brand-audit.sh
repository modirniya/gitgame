#!/usr/bin/env bash
# Lists every use of the working product name and fails on non-canonical spellings.
# The name is not final (see docs/branding.md); this is how a rename stays a one-pass job.
#
# Usage: scripts/brand-audit.sh          # list occurrences, exit 1 if any spelling is off
#        scripts/brand-audit.sh --quiet  # exit status only
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

quiet=0; [[ "${1:-}" == "--quiet" ]] && quiet=1

# Files that may legitimately contain the name in odd forms: none today. The license text does not mention it.
exclude=(':!LICENSE')

# Canonical: "Git Game" (prose), "GitGame" (identifiers), "gitgame" (slugs, domain).
# Anything else that looks like the name is a violation.
all=$(git grep -n -I -i -E 'git ?[-_]?game' -- . "${exclude[@]}" || true)
# A line may opt out by carrying the marker 'brand-audit: ignore' (used where wrong spellings are quoted on purpose).
bad=$(printf '%s\n' "$all" | grep -v 'brand-audit: ignore' | grep -v -E 'Git Game|GitGame|gitgame|GITGAME_' | grep -i -E 'git ?[-_]?game' || true)

if (( ! quiet )); then
  echo "== Occurrences of the product name =="
  printf '%s\n' "$all"
  echo
  echo "== Definitions marked BRAND =="
  git grep -n -I -E '(#|//|<!--|") ?BRAND' -- . || echo "(none yet — added when server/, web/, rules/ exist)"
  echo
fi

if [[ -n "$bad" ]]; then
  echo "== Non-canonical spellings (fix these) ==" >&2
  printf '%s\n' "$bad" >&2
  exit 1
fi
(( quiet )) || echo "OK: all spellings canonical."
