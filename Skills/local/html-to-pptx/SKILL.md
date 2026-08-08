---
name: html-to-pptx
description: Converts a single-page HTML slide deck (Claude-generated web
  presentation) into a visually matching, fully editable PowerPoint (.pptx)
  with native PowerPoint objects and embedded fonts. Use whenever the user
  wants an HTML presentation as PowerPoint / pptx / "editable deck for
  colleagues", mentions converting a web deck to PowerPoint, or asks to
  export slides for Office users.
---

# HTML deck → editable PowerPoint

Converts an HTML slide deck into a .pptx where every title, card, pill, and
shape is a native, editable PowerPoint object. Interactive decks (arrow-key
states) become one slide per visual state.

## Steps

1. **Setup (first run on a machine only).** If `node_modules/` or `.venv/`
   is missing in this skill folder, run `./setup.sh` and relay any notes
   about LibreOffice/Poppler to the user.

2. **Convert.** Run:
   `./scripts/convert.sh "<path to deck.html>" <workDir>`
   (pick a scratchpad folder as workDir). The .pptx lands next to the HTML.

3. **Verify visually (do not skip).** The work dir has originals
   (`assets/state-NN.png`) and rebuilt renders (`render/slide-N.png`,
   1-based). Read each pair side by side. Look for: missing elements, text
   overflowing or wrapping differently, wrong colors/stacking, misplaced
   blocks. Fix by editing `<workDir>/slides.json` values and re-running only
   the rebuild half:
   `.venv/bin/python scripts/rebuild.py <workDir>/slides.json "<out.pptx>"`
   then `.venv/bin/python scripts/embed_fonts.py "<out.pptx>" <workDir>/slides.json`
   and re-render. If a whole category is off (every slide the same drift),
   fix `scripts/` instead and mention it to the user as a tool improvement.
   If `render_pptx.py` reports LibreOffice/Poppler missing, tell the user
   the install commands it printed and deliver the deck unverified, saying so.

4. **Report.** Tell the user in plain English:
   - where the .pptx is, slide count (and why it differs from the HTML
     slide count when interactive states were expanded);
   - which fonts were embedded, and any fonts that could not be;
   - anything skipped or approximated (missing images, complex graphics
     kept as pictures, slides inserted as pictures) and what they can do;
   - repeat each capture warning line verbatim if any appeared.

## Notes

- Only arrow-key-driven interactivity is explored. Hover-only content and
  animations do not carry over (each state is a still).
- Complex vector art becomes a crisp picture; everything else is editable.
- If the user reports a systematic conversion bug, fix it in the source
  project ("Web Presentation to PowerPoint" under Projects) and re-copy the
  skill per its PROJECT.md.