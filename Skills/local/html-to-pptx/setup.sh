#!/bin/bash
# One-time setup for the html-to-pptx skill. Safe to re-run.
set -e
cd "$(dirname "$0")"

echo "== Node dependencies =="
npm install
npx playwright install chromium

echo "== Python environment =="
if [ ! -d .venv ]; then python3 -m venv .venv; fi
.venv/bin/pip install -q -r requirements.txt

echo "== Optional verify tools =="
if ! command -v soffice >/dev/null && [ ! -x "/Applications/LibreOffice.app/Contents/MacOS/soffice" ]; then
  echo "NOTE: LibreOffice not found. The visual verify pass needs it:"
  echo "      brew install --cask libreoffice"
fi
if ! command -v pdftoppm >/dev/null; then
  echo "NOTE: pdftoppm (Poppler) not found. The visual verify pass needs it:"
  echo "      brew install poppler"
fi
echo "Setup complete."
