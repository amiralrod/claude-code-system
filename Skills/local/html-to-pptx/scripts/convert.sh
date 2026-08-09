#!/bin/bash
# convert.sh <deck.html> [workDir] — full pipeline: capture -> rebuild ->
# embed fonts -> render for verification. Output .pptx lands next to the HTML.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
SKILL="$(dirname "$HERE")"
DECK="$1"
[ -f "$DECK" ] || { echo "Deck not found: $DECK"; exit 2; }
WORK="${2:-$(mktemp -d)}"
BASE="$(basename "${DECK%.*}")"
OUT="$(cd "$(dirname "$DECK")" && pwd)/$BASE.pptx"

# Preflight: abort early if any required dependency is missing
"$HERE/check_deps.sh" --required-only || exit 1

node "$HERE/capture.js" "$DECK" "$WORK"
"$SKILL/.venv/bin/python" "$HERE/rebuild.py" "$WORK/slides.json" "$OUT"
"$SKILL/.venv/bin/python" "$HERE/embed_fonts.py" "$OUT" "$WORK/slides.json"
"$SKILL/.venv/bin/python" "$HERE/render_pptx.py" "$OUT" "$WORK/render" || true

echo ""
echo "DONE: $OUT"
echo "Work dir (originals in assets/, rebuilt renders in render/): $WORK"
