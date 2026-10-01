#!/usr/bin/env bash
# Draws web/public/og.png, the landing page's link-preview image (1200×630, ADR-0009), from scripts/og-image.html with
# a Chromium-based browser in headless mode. Run it again after a rename (docs/branding.md) or a change of the look.
#
# Usage: scripts/og-image.sh                    # finds Chrome, Brave or Chromium
#        scripts/og-image.sh /path/to/browser   # or uses the one named
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

browser="${1:-}"
if [[ -z "$browser" ]]; then
  for b in "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" \
    "/Applications/Chromium.app/Contents/MacOS/Chromium" \
    "$(command -v google-chrome || true)" "$(command -v chromium || true)"; do
    if [[ -n "$b" && -x "$b" ]]; then browser="$b"; break; fi
  done
fi
[[ -n "$browser" ]] || { echo "no Chromium-based browser found; name one: scripts/og-image.sh /path/to/it" >&2; exit 1; }

"$browser" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size=1200,630 \
  --screenshot="$PWD/web/public/og.png" "file://$PWD/scripts/og-image.html" 2>/dev/null
echo "web/public/og.png: $(sips -g pixelWidth -g pixelHeight web/public/og.png 2>/dev/null | awk '/pixel/ {print $2}' | paste -sd x - || true)"
