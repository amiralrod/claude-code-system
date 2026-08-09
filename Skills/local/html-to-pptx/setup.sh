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

echo ""
echo "== Dependency check =="
scripts/check_deps.sh
