#!/usr/bin/env node
// capture.js <deck.html> <outDir> — renders the deck headlessly, steps
// through all states with ArrowRight, writes slides.json + assets/.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const MAX_STATES = 200;
const DISABLE_MOTION_CSS = `
*, *::before, *::after {
  transition: none !important;
  animation: none !important;
  caret-color: transparent !important;
}`;

async function main() {
  const [htmlArg, outDir] = process.argv.slice(2);
  if (!htmlArg || !outDir) {
    console.error('Usage: node capture.js <deck.html> <outDir>');
    process.exit(2);
  }
  const htmlPath = path.resolve(htmlArg);
  if (!fs.existsSync(htmlPath)) {
    console.error(`Deck not found: ${htmlPath}`);
    process.exit(2);
  }
  const assetsDir = path.join(outDir, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });
  const warnings = [];

  const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  // 1280x720 matches how these decks are actually viewed in a browser.
  // Their CSS clamps font sizes in px, so a larger viewport would make text
  // proportionally smaller on the slide. Geometry is normalized to 1920 later.
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await page.goto('file://' + htmlPath, { waitUntil: 'load' });
  await page.addStyleTag({ content: DISABLE_MOTION_CSS });
  await page.evaluate(() => document.fonts.ready.then(() => {}));
  await page.evaluate(() => {
    document.querySelectorAll('svg').forEach(s => {
      try { s.pauseAnimations(); s.setCurrentTime(0); } catch (e) {}
    });
  });
  await page.addScriptTag({
    content: fs.readFileSync(path.join(__dirname, 'extract.js'), 'utf8'),
  });
  await page.waitForTimeout(400);

  const seen = new Set();
  const slides = [];
  let frame = null;

  for (let i = 0; i < MAX_STATES; i++) {
    await page.waitForTimeout(120);
    let state = null;
    try {
      state = await page.evaluate(() => window.__extractState());
    } catch (e) {
      warnings.push(`State ${i + 1} could not be parsed (${e.message.split('\n')[0]}); ` +
        'inserted as a full-slide picture.');
    }
    if (state) {
      if (seen.has(state.signature)) break;
      seen.add(state.signature);
      frame = state.frame;
    } else if (slides.length && slides[slides.length - 1].failed) {
      break; // two unparseable states in a row: stop rather than loop
    }

    const shot = `state-${String(slides.length).padStart(2, '0')}.png`;
    await page.screenshot({
      path: path.join(assetsDir, shot),
      clip: frame
        ? { x: frame.x, y: frame.y, width: frame.w, height: frame.h }
        : undefined,
    });

    const elements = state ? await materializeAssets(page, state.elements, assetsDir, warnings) : [];
    slides.push({
      index: slides.length,
      screenshot: `assets/${shot}`,
      failed: !state,
      elements,
    });
    await page.keyboard.press('ArrowRight');
  }

  const fonts = collectFonts(slides);
  const out = {
    sourceHtml: htmlPath,
    capturedAt: new Date().toISOString(),
    viewport: { width: 1920, height: 1080 },
    fonts, warnings, slides,
  };
  fs.writeFileSync(path.join(outDir, 'slides.json'), JSON.stringify(out, null, 1));
  await browser.close();
  console.log(`Captured ${slides.length} slide state(s) -> ${path.join(outDir, 'slides.json')}`);
  for (const w of warnings) console.log('WARNING: ' + w);
}

// Handles plain file images here; CSS-filtered images and SVGs go through
// the browser (canvas / isolated render).
async function materializeAssets(page, elements, assetsDir, warnings) {
  const kept = [];
  let n = 0;
  for (const el of elements) {
    if (el.type === 'image') {
      n++;
      const dest = `img-${n}.png`;
      const ok = await saveImage(page, el, path.join(assetsDir, dest), warnings);
      if (!ok) continue;
      el.src = `assets/${dest}`;
      delete el.domId;
      kept.push(el);
    } else if (el.type === 'svgPicture') {
      n++;
      const dest = `svg-${n}.png`;
      const ok = await saveSvg(page, el, path.join(assetsDir, dest), warnings);
      if (!ok) continue;
      el.src = `assets/${dest}`;
      delete el.domId;
      kept.push(el);
    } else kept.push(el);
  }
  return kept;
}

async function saveImage(page, el, destPath, warnings) {
  try {
    if (!el.srcUrl) throw new Error('image has no source');
    if (el.srcUrl.startsWith('file://') && !el.filter) {
      const p = decodeURIComponent(new URL(el.srcUrl).pathname);
      if (!fs.existsSync(p)) {
        warnings.push(`Image skipped — file not found: ${p}. ` +
          'Put the file there and re-run to include it.');
        return false;
      }
      fs.copyFileSync(p, destPath);
      return true;
    }
    // data: URLs and filtered images: redraw through a canvas so the
    // browser applies the CSS filter and keeps transparency.
    const dataUrl = await page.evaluate((id) => {
      const img = document.querySelector(`[data-x2p-id="${id}"]`);
      if (!img || !img.naturalWidth) return null;
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext('2d');
      ctx.filter = getComputedStyle(img).filter;
      ctx.drawImage(img, 0, 0);
      return c.toDataURL('image/png');
    }, el.domId);
    if (!dataUrl) throw new Error('image not loaded');
    fs.writeFileSync(destPath, Buffer.from(dataUrl.split(',')[1], 'base64'));
    return true;
  } catch (e) {
    warnings.push(`Image skipped (${el.srcUrl || 'unknown'}): ${e.message}`);
    return false;
  }
}

// Complex SVGs render in an isolated page with a transparent background so
// the exported PNG doesn't bake in whatever sat behind the graphic.
async function saveSvg(page, el, destPath, warnings) {
  try {
    if (!el.svgMarkup) throw new Error('svg markup missing');
    const iso = await page.context().newPage();
    await iso.setViewportSize({
      width: Math.max(1, Math.ceil(el.w)), height: Math.max(1, Math.ceil(el.h)),
    });
    await iso.setContent(
      `<style>html,body{margin:0;background:transparent}` +
      `svg{display:block;width:${el.w}px;height:${el.h}px}</style>` + el.svgMarkup);
    await iso.evaluate(() => {
      document.querySelectorAll('svg').forEach(s => {
        try { s.pauseAnimations(); s.setCurrentTime(0); } catch (e) {}
      });
    });
    await iso.screenshot({ path: destPath, omitBackground: true });
    await iso.close();
    delete el.svgMarkup;
    return true;
  } catch (e) {
    warnings.push(`SVG graphic skipped: ${e.message}`);
    return false;
  }
}

function collectFonts(slides) {
  const set = new Map();
  for (const s of slides) for (const el of s.elements) {
    if (el.type !== 'text') continue;
    for (const p of el.paragraphs) for (const r of p.runs) {
      const key = `${r.fontFamily}|${r.weight}|${r.italic}`;
      set.set(key, { family: r.fontFamily, weight: r.weight, italic: r.italic });
    }
  }
  return [...set.values()];
}

main().catch(e => { console.error(e); process.exit(1); });
