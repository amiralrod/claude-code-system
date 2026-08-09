# html-to-pptx

Converts a single-page HTML slide deck into a fully editable PowerPoint file (.pptx). Every title, card, and pill becomes a native PowerPoint shape — not a screenshot.

**Platform:** macOS and Linux. Windows is not supported (bash scripts, system font paths).

## What it does

- Captures every visual state of the deck (arrow-key driven interactivity → one slide per state)
- Extracts shapes, gradients, text runs, images, and SVGs from the DOM
- Rebuilds them as native PowerPoint objects with python-pptx
- Embeds the deck's fonts directly in the .pptx
- Optionally renders before/after screenshots for visual review (requires LibreOffice + Poppler)

## Install

This is a [Claude Code](https://claude.ai/code) skill. Install it by giving Claude the SKILL.md URL and asking it to add the skill:

> "Add this skill: `https://raw.githubusercontent.com/amiralrod/claude-code-system/main/Skills/local/html-to-pptx/SKILL.md`"

Claude will download the skill and all its scripts automatically, then run setup.

**Manual install** (if you prefer):

```bash
# 1. Clone or download this folder to your skills directory
git clone https://github.com/amiralrod/claude-code-system /tmp/claude-skills
cp -r /tmp/claude-skills/Skills/local/html-to-pptx ~/ClaudeSystem/Skills/local/

# 2. Run setup (installs Node + Python deps, downloads Playwright's Chromium)
bash ~/ClaudeSystem/Skills/local/html-to-pptx/setup.sh
```

## Check dependencies

```bash
bash scripts/check_deps.sh
```

Reports what is installed, what is missing, and the exact install command for your platform.

## Usage

Once installed, just tell Claude:

> "Convert this deck to PowerPoint"

Claude runs the full pipeline. You can also run it directly:

```bash
bash scripts/convert.sh path/to/deck.html [optional-work-dir]
```

The .pptx lands next to the HTML file.

## Requirements

**Required** (PPTX creation fails without these):
- Node.js + npm — for Playwright slide capture
- Python 3.8+ — for PPTX rebuilding
- Playwright Chromium — downloaded by `setup.sh`
- python-pptx, lxml — installed by `setup.sh`

**Optional** (needed only for the visual before/after verify step):
- LibreOffice — renders .pptx to PDF
- Poppler (pdftoppm) — converts PDF pages to PNG

Missing optional deps: you still get the .pptx; the verify step is skipped with a clear message.

## How it works

1. **Capture** (`scripts/capture.js`): Playwright opens the deck headlessly at 1280×720, steps through all arrow-key states, and calls `extract.js` on each. `extract.js` reads the DOM and emits a JSON description of every painted element (boxes, gradients, text runs, images, SVGs), normalised to a 1920×1080 coordinate space.

2. **Rebuild** (`scripts/rebuild.py`): Reads the JSON and creates a .pptx with python-pptx — native shapes, not screenshots.

3. **Fonts** (`scripts/embed_fonts.py`): Finds TTF files on your system or downloads them from Google Fonts, then embeds them in the .pptx so colleagues see the right typefaces.

4. **Verify** (`scripts/render_pptx.py`): Renders each slide via LibreOffice + Poppler so you can compare the original screenshot with the rebuilt output side by side.

## License

MIT — see [LICENSE](LICENSE).
