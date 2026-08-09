#!/bin/bash
# check_deps.sh [--required-only]
# Reports missing html-to-pptx dependencies in one pass.
# Exit 0: all required deps present (optional may still be missing).
# Exit 1: one or more required deps missing.

REQUIRED_ONLY=false
[[ "$1" == "--required-only" ]] && REQUIRED_ONLY=true

HERE="$(cd "$(dirname "$0")" && pwd)"
SKILL="$(dirname "$HERE")"

OS="$(uname -s)"
case "$OS" in
  Darwin) PLATFORM="macos" ;;
  Linux)  PLATFORM="linux" ;;
  *)      PLATFORM="unknown" ;;
esac

RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; NC='\033[0m'
ok()   { echo -e "  ${GREEN}✓${NC} $*"; }
warn() { echo -e "  ${YELLOW}!${NC} $*"; }
fail() { echo -e "  ${RED}✗${NC} $*"; }

hint() {
  # hint <brew> <brew-cask-flag: true/false> <apt-pkg>
  local pkg="$1" cask="$2" apt="$3"
  case "$PLATFORM" in
    macos)
      if [ "$cask" = "true" ]; then
        echo "        brew install --cask $pkg"
      else
        echo "        brew install $pkg"
      fi
      ;;
    linux)
      echo "        sudo apt-get install $apt    # Debian/Ubuntu"
      echo "        sudo dnf install $apt         # Fedora/RHEL"
      ;;
    *)
      echo "        Install $pkg for your platform"
      ;;
  esac
}

missing_req=0
missing_opt=0

echo ""
echo "=== html-to-pptx dependency check ==="
echo ""
echo "Required (PPTX creation will fail without these):"

# node
if command -v node >/dev/null 2>&1; then
  ok "node $(node --version)"
else
  fail "node — not found. The slide-capture step needs it."
  hint "node" "false" "nodejs"
  missing_req=$((missing_req + 1))
fi

# npm
if command -v npm >/dev/null 2>&1; then
  ok "npm $(npm --version)"
else
  fail "npm — not found. Needed to install Playwright."
  hint "node" "false" "npm"
  missing_req=$((missing_req + 1))
fi

# python3
if command -v python3 >/dev/null 2>&1; then
  ok "python3 $(python3 --version 2>&1 | awk '{print $2}')"
else
  fail "python3 — not found. The PPTX builder needs it."
  hint "python@3" "false" "python3"
  missing_req=$((missing_req + 1))
fi

# Playwright + chromium binary
if [ -d "$SKILL/node_modules" ] && node -e "require('playwright')" 2>/dev/null; then
  if node -e "
    try {
      const {chromium} = require('playwright');
      const p = chromium.executablePath();
      require('fs').accessSync(p);
      process.exit(0);
    } catch(e) { process.exit(1); }
  " 2>/dev/null; then
    ok "Playwright + Chromium browser"
  else
    fail "Playwright installed but Chromium browser not downloaded."
    echo "        cd $SKILL && npx playwright install chromium"
    missing_req=$((missing_req + 1))
  fi
else
  fail "Playwright not installed (node_modules missing or incomplete)."
  echo "        bash $SKILL/setup.sh"
  missing_req=$((missing_req + 1))
fi

# python-pptx in .venv
if [ -d "$SKILL/.venv" ] && "$SKILL/.venv/bin/python" -c "import pptx" 2>/dev/null; then
  ok "python-pptx (.venv)"
else
  fail "python-pptx not installed in .venv."
  echo "        bash $SKILL/setup.sh"
  missing_req=$((missing_req + 1))
fi

if ! $REQUIRED_ONLY; then
  echo ""
  echo "Optional (needed for the visual verify step only — PPTX is still created without them):"

  so_found=false
  if command -v soffice >/dev/null 2>&1; then
    ok "LibreOffice (soffice in PATH)"; so_found=true
  elif [ -x "/Applications/LibreOffice.app/Contents/MacOS/soffice" ]; then
    ok "LibreOffice (/Applications)"; so_found=true
  fi
  if ! $so_found; then
    warn "LibreOffice not found — visual verify will be skipped (you still get the .pptx)."
    hint "libreoffice" "true" "libreoffice"
    missing_opt=$((missing_opt + 1))
  fi

  if command -v pdftoppm >/dev/null 2>&1; then
    ok "poppler (pdftoppm)"
  else
    warn "poppler (pdftoppm) not found — visual verify will be skipped."
    hint "poppler" "false" "poppler-utils"
    missing_opt=$((missing_opt + 1))
  fi
fi

echo ""
if [ "$missing_req" -gt 0 ]; then
  echo -e "${RED}${missing_req} required dependency(ies) missing. Run: bash $SKILL/setup.sh${NC}"
  exit 1
elif [ "$missing_opt" -gt 0 ] && ! $REQUIRED_ONLY; then
  echo -e "${YELLOW}Required dependencies OK. ${missing_opt} optional dep(s) missing — visual verify will be skipped.${NC}"
  exit 0
else
  echo -e "${GREEN}All dependencies present.${NC}"
  exit 0
fi
