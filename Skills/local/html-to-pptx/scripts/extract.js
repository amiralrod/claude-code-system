// Injected into the deck page. window.__extractState() returns the current
// visual state: {frame, elements, signature} with coordinates normalized
// to a 1920x1080 frame. Pure DOM reading; no side effects besides tagging
// elements needing capture with data-x2p-id.
(() => {
  function parseColor(str) {
    if (!str) return null;
    const m = str.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/);
    if (!m) return null;
    const a = m[4] === undefined ? 1 : parseFloat(m[4]);
    if (a < 0.02) return null;
    const hex = [m[1], m[2], m[3]]
      .map(v => Math.round(parseFloat(v)).toString(16).padStart(2, '0'))
      .join('').toUpperCase();
    return { color: hex, alpha: Math.round(a * 100) / 100 };
  }

  function splitTop(s) {
    const parts = []; let depth = 0, cur = '';
    for (const ch of s) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
    }
    parts.push(cur);
    return parts.map(p => p.trim()).filter(Boolean);
  }

  function parseGradient(bgImage) {
    const m = bgImage && bgImage.match(/linear-gradient\((.*)\)/s);
    if (!m) return null;
    const parts = splitTop(m[1]);
    let angle = 180;
    if (/^-?[\d.]+deg$/.test(parts[0])) angle = parseFloat(parts.shift());
    else if (parts[0].startsWith('to ')) {
      angle = { 'to top': 0, 'to right': 90, 'to bottom': 180, 'to left': 270 }[parts.shift()] ?? 180;
    }
    if (parts.length < 2) return null;
    const stops = parts.map((p, i) => {
      const c = parseColor(p) || { color: '000000', alpha: 1 };
      const pm = p.match(/([\d.]+)%\s*$/);
      return { color: c.color, alpha: c.alpha,
               pos: pm ? parseFloat(pm[1]) / 100 : i / (parts.length - 1) };
    });
    return { type: 'gradient', angle, stops };
  }

  function parseShadow(str) {
    if (!str || str === 'none') return null;
    const first = splitTop(str)[0];
    if (first.includes('inset')) return null;
    const c = parseColor(first) || { color: '000000', alpha: 0.3 };
    const nums = first.replace(/rgba?\([^)]*\)/, '').trim().split(/\s+/)
      .map(parseFloat).filter(n => !isNaN(n));
    const [dx = 0, dy = 0, blur = 0] = nums;
    return { dx, dy, blur, color: c.color, alpha: c.alpha };
  }

  function isVisible(el) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    if (parseFloat(cs.opacity) < 0.02) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 1 && r.height >= 1;
  }

  // Frame = the visible slide surface. Descend from body while a child
  // covers ~the whole node (or is the only visible child) and the node
  // itself paints nothing (body exempt from the paint check).
  function findFrame() {
    let node = document.body;
    for (;;) {
      if (node !== document.body) {
        const cs = getComputedStyle(node);
        const painted = parseColor(cs.backgroundColor) || parseGradient(cs.backgroundImage) ||
          parseFloat(cs.borderTopWidth) > 0;
        if (painted) break;
      }
      const kids = [...node.children].filter(isVisible);
      if (!kids.length) break;
      const nr = node.getBoundingClientRect();
      let best = null, bestArea = -1;
      for (const k of kids) {
        const r = k.getBoundingClientRect();
        if (r.width * r.height > bestArea) { bestArea = r.width * r.height; best = k; }
      }
      const cover = bestArea / Math.max(1, nr.width * nr.height);
      if (kids.length === 1 || cover >= 0.98) node = best; else break;
    }
    return node;
  }

  window.__extractState = function extractState() {
    const frame = findFrame();
    const fr = frame.getBoundingClientRect();
    const scale = 1920 / fr.width;
    const N = v => Math.round(v * scale * 10) / 10;
    const NX = v => N(v - fr.left);
    const NY = v => N(v - fr.top);
    const elements = [];
    let ord = 0, domIdCounter = 0;

    function zPathOf(el) {
      const p = [];
      for (let n = el; n && n !== frame.parentElement; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.position !== 'static' && cs.zIndex !== 'auto') p.unshift(parseInt(cs.zIndex) || 0);
      }
      return p;
    }

    function base(el, r) {
      return { x: NX(r.left), y: NY(r.top), w: N(r.width), h: N(r.height),
               z: zPathOf(el), ord: ord++ };
    }

    function radiusOf(cs, r) {
      const raw = cs.borderTopLeftRadius.split(' ')[0];
      let rad = raw.endsWith('%')
        ? (parseFloat(raw) / 100) * Math.min(r.width, r.height)
        : parseFloat(raw) || 0;
      return Math.min(rad, Math.min(r.width, r.height) / 2);
    }

    function pushBoxIfPainted(el, cs, r, opacity) {
      const fill = parseGradient(cs.backgroundImage) || parseColor(cs.backgroundColor);
      const sides = ['Top', 'Right', 'Bottom', 'Left'].map(s => ({
        w: parseFloat(cs['border' + s + 'Width']) || 0,
        c: parseColor(cs['border' + s + 'Color']),
      }));
      const on = sides.filter(s => s.w > 0 && s.c);
      const uniform = on.length === 4 && sides.every(s =>
        s.w === sides[0].w && s.c && s.c.color === sides[0].c.color);
      if (!fill && !on.length) return;

      let rad = radiusOf(cs, r);
      // a square child clipped by a rounded overflow-hidden ancestor inherits
      // the rounding on the corners it shares with that ancestor
      let corners = null;
      if (rad === 0) {
        for (let anc = el.parentElement; anc && anc !== frame.parentElement; anc = anc.parentElement) {
          const acs = getComputedStyle(anc);
          if (acs.overflow !== 'hidden' && acs.overflowX !== 'hidden') continue;
          const ar = anc.getBoundingClientRect();
          const aRad = radiusOf(acs, ar);
          if (aRad > 0) {
            const near = (a, b) => Math.abs(a - b) < 2;
            const c = {
              tl: near(r.left, ar.left) && near(r.top, ar.top),
              tr: near(r.right, ar.right) && near(r.top, ar.top),
              bl: near(r.left, ar.left) && near(r.bottom, ar.bottom),
              br: near(r.right, ar.right) && near(r.bottom, ar.bottom),
            };
            if (c.tl || c.tr || c.bl || c.br) { corners = c; rad = aRad; }
          }
          break;
        }
      }
      if (fill || uniform) {
        const f = fill ? { type: 'solid', ...fill } : null; // gradient spread overrides type
        if (f && f.type !== 'gradient') f.alpha = Math.round(f.alpha * opacity * 100) / 100;
        elements.push({
          type: 'box',
          shape: rad >= Math.min(r.width, r.height) / 2 - 0.5 && Math.abs(r.width - r.height) < 2
            ? 'ellipse' : (rad > 0 ? 'roundRect' : 'rect'),
          ...base(el, r), fill: f, radius: N(rad), corners,
          border: uniform ? { color: sides[0].c.color, alpha: sides[0].c.alpha, width: N(sides[0].w) } : null,
          shadow: parseShadow(cs.boxShadow),
        });
      }
      if (!uniform && on.length) {
        const seg = {
          Top:    [r.left, r.top, r.right, r.top],
          Right:  [r.right, r.top, r.right, r.bottom],
          Bottom: [r.left, r.bottom, r.right, r.bottom],
          Left:   [r.left, r.top, r.left, r.bottom],
        };
        ['Top', 'Right', 'Bottom', 'Left'].forEach((name, i) => {
          const s = sides[i];
          if (!(s.w > 0 && s.c)) return;
          const [x1, y1, x2, y2] = seg[name];
          elements.push({ type: 'line', x1: NX(x1), y1: NY(y1), x2: NX(x2), y2: NY(y2),
            color: s.c.color, alpha: Math.round(s.c.alpha * opacity * 100) / 100,
            width: N(s.w), z: zPathOf(el), ord: ord++ });
        });
      }
    }

    function pushPseudo(el, which, r, opacity) {
      const cs = getComputedStyle(el, which);
      if (cs.content === 'none' || cs.display === 'none') return;
      if (cs.position !== 'absolute') return;
      const w = parseFloat(cs.width), h = parseFloat(cs.height);
      if (!w || !h) return;
      const fill = parseGradient(cs.backgroundImage) || parseColor(cs.backgroundColor);
      if (!fill) return;
      const left = cs.left !== 'auto' ? r.left + parseFloat(cs.left)
        : r.right - parseFloat(cs.right || 0) - w;
      const top = cs.top !== 'auto' ? r.top + parseFloat(cs.top)
        : r.bottom - parseFloat(cs.bottom || 0) - h;
      const rr = { left, top, right: left + w, bottom: top + h, width: w, height: h };
      const rad = radiusOf(cs, rr);
      const f = { type: 'solid', ...fill };
      const pOp = parseFloat(cs.opacity);
      if (f.type !== 'gradient') f.alpha = Math.round(f.alpha * opacity * pOp * 100) / 100;
      const zp = zPathOf(el);
      if (cs.zIndex !== 'auto') zp.push(parseInt(cs.zIndex) || 0);
      elements.push({
        type: 'box',
        shape: rad >= Math.min(w, h) / 2 - 0.5 && Math.abs(w - h) < 2 ? 'ellipse'
          : (rad > 0 ? 'roundRect' : 'rect'),
        x: NX(left), y: NY(top), w: N(w), h: N(h), z: zp, ord: ord++,
        fill: f, radius: N(rad), border: null, shadow: null,
      });
    }

    function applyTransformCase(t, cs) {
      if (cs.textTransform === 'uppercase') return t.toUpperCase();
      if (cs.textTransform === 'lowercase') return t.toLowerCase();
      if (cs.textTransform === 'capitalize') return t.replace(/\b\w/g, c => c.toUpperCase());
      return t;
    }

    function makeRun(text, el, opacity) {
      const cs = getComputedStyle(el);
      const col = parseColor(cs.color) || { color: '000000', alpha: 1 };
      return {
        text: applyTransformCase(text, cs),
        fontFamily: cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(),
        fontSizePx: Math.round(parseFloat(cs.fontSize) * scale * 10) / 10,
        weight: parseInt(cs.fontWeight) || 400,
        italic: cs.fontStyle.includes('italic'),
        color: col.color,
        alpha: Math.round(col.alpha * opacity * 100) / 100,
        letterSpacingPx: cs.letterSpacing === 'normal' ? 0
          : Math.round(parseFloat(cs.letterSpacing) * scale * 100) / 100,
      };
    }

    function collectRuns(el, opacity, runs) {
      for (const node of el.childNodes) {
        if (node.nodeType === 3) {
          const t = node.textContent.replace(/\s+/g, ' ');
          if (t) runs.push(makeRun(t, el, opacity));
        } else if (node.nodeType === 1) {
          if (node.tagName === 'BR') runs.push({ br: true });
          else if (isVisible(node)) {
            const ncs = getComputedStyle(node);
            const isBlock = !ncs.display.startsWith('inline');
            if (isBlock) runs.push({ br: true }); // block child = new line
            collectRuns(node, opacity * parseFloat(ncs.opacity), runs);
            if (isBlock) runs.push({ br: true });
          }
        }
      }
    }

    function trimParagraph(runs) {
      const out = runs.filter(r => !r.br);
      if (out.length) {
        out[0].text = out[0].text.replace(/^\s+/, '');
        out[out.length - 1].text = out[out.length - 1].text.replace(/\s+$/, '');
      }
      return out.filter(r => r.text.length);
    }

    function contentBox(cs, r) {
      const pl = parseFloat(cs.paddingLeft) || 0, pr = parseFloat(cs.paddingRight) || 0;
      const pt = parseFloat(cs.paddingTop) || 0, pb = parseFloat(cs.paddingBottom) || 0;
      return { left: r.left + pl, top: r.top + pt,
               width: r.width - pl - pr, height: r.height - pt - pb };
    }

    function lineHeightPx(cs) {
      return cs.lineHeight === 'normal'
        ? Math.round(parseFloat(cs.fontSize) * 1.2 * scale)
        : Math.round(parseFloat(cs.lineHeight) * scale * 10) / 10;
    }

    function pushText(el, cs, r, opacity) {
      const runs = [];
      collectRuns(el, opacity, runs);
      const groups = [[]];
      for (const rn of runs) { if (rn.br) groups.push([]); else groups[groups.length - 1].push(rn); }
      const paragraphs = groups.map(g => ({ bullet: null, runs: trimParagraph(g) }))
        .filter(p => p.runs.length);
      if (!paragraphs.length) return;
      const cb = contentBox(cs, r);
      elements.push({
        type: 'text', x: NX(cb.left), y: NY(cb.top), w: N(cb.width), h: N(cb.height),
        z: zPathOf(el), ord: ord++,
        align: ['center', 'right', 'justify'].includes(cs.textAlign) ? cs.textAlign : 'left',
        lineHeightPx: lineHeightPx(cs), paragraphs,
      });
    }

    function pushList(el, cs, r, opacity) {
      const items = [...el.children].filter(li => li.tagName === 'LI' && isVisible(li));
      if (!items.length) return;
      const paragraphs = items.map(li => {
        const runs = [];
        collectRuns(li, opacity, runs);
        const liCs = getComputedStyle(li);
        const pb = getComputedStyle(li, '::before');
        const bulletColor =
          (pb.content !== 'none' && parseColor(pb.backgroundColor)) ||
          parseColor(liCs.color) || { color: '000000' };
        const indentPx = Math.max(12, parseFloat(liCs.paddingLeft) || 0) * scale;
        return { bullet: { char: '•', color: bulletColor.color, indentPx: Math.round(indentPx) },
                 runs: trimParagraph(runs) };
      }).filter(p => p.runs.length);
      if (!paragraphs.length) return;
      const cb = contentBox(cs, r);
      elements.push({
        type: 'text', x: NX(cb.left), y: NY(cb.top), w: N(cb.width), h: N(cb.height),
        z: zPathOf(el), ord: ord++, align: 'left',
        lineHeightPx: lineHeightPx(getComputedStyle(items[0])), paragraphs,
      });
    }

    function isTextBlock(el) {
      if ([...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return true;
      const kids = [...el.children];
      if (!kids.length || !el.textContent.trim()) return false;
      if (!kids.every(c => c.tagName === 'BR' || getComputedStyle(c).display.startsWith('inline'))) return false;
      // An inline child with its own painted background must be visited separately
      // so its background shape is emitted; absorbing it into this text run would
      // silently drop the child's fill (e.g. a coloured pill inside a card).
      if (kids.some(c => {
        const cs = getComputedStyle(c);
        return parseColor(cs.backgroundColor) !== null || parseGradient(cs.backgroundImage) !== null;
      })) return false;
      return true;
    }

    function tagFor(el) {
      if (!el.dataset.x2pId) el.dataset.x2pId = String(++domIdCounter) + '-' + Date.now();
      return el.dataset.x2pId;
    }

    function pushImage(el, cs, r, opacity) {
      elements.push({
        type: 'image', ...base(el, r),
        srcUrl: el.currentSrc || el.src || '',
        filter: cs.filter && cs.filter !== 'none' ? cs.filter : null,
        opacity: Math.round(opacity * 100) / 100,
        domId: tagFor(el),
      });
    }

    function svgChildren(el) {
      return [...el.querySelectorAll('*')];
    }

    function svgIsSimple(el) {
      const allowed = new Set(['circle', 'ellipse', 'line', 'rect', 'g']);
      const kids = svgChildren(el);
      return kids.length > 0 && kids.length <= 40 &&
        kids.every(k => allowed.has(k.tagName.toLowerCase()));
    }

    function svgPaint(k, attr, cssProp) {
      const cs = getComputedStyle(k);
      const v = cs[cssProp] || k.getAttribute(attr);
      const c = parseColor(v) || (v && v !== 'none' && /^#/.test(v)
        ? { color: v.slice(1).toUpperCase().padEnd(6, '0'), alpha: 1 } : null);
      if (!c) return null;
      const op = parseFloat(cs[cssProp + 'Opacity'] ?? 1) * parseFloat(cs.opacity || 1);
      return { ...c, alpha: Math.round(c.alpha * op * 100) / 100 };
    }

    function pushSvg(el, r, opacity) {
      if (svgIsSimple(el)) {
        for (const k of svgChildren(el)) {
          const tag = k.tagName.toLowerCase();
          if (tag === 'g') continue;
          const kr = k.getBoundingClientRect();
          if (tag === 'line') {
            const ctm = k.getScreenCTM();
            const tp = (x, y) => new DOMPoint(x, y).matrixTransform(ctm);
            const p1 = tp(parseFloat(k.getAttribute('x1') || 0), parseFloat(k.getAttribute('y1') || 0));
            const p2 = tp(parseFloat(k.getAttribute('x2') || 0), parseFloat(k.getAttribute('y2') || 0));
            const stroke = svgPaint(k, 'stroke', 'stroke');
            if (!stroke) continue;
            elements.push({ type: 'line', fromSvg: true,
              x1: NX(p1.x), y1: NY(p1.y), x2: NX(p2.x), y2: NY(p2.y),
              color: stroke.color, alpha: Math.round(stroke.alpha * opacity * 100) / 100,
              width: N(parseFloat(k.getAttribute('stroke-width') || getComputedStyle(k).strokeWidth) || 1),
              z: zPathOf(el), ord: ord++ });
          } else {
            const fill = svgPaint(k, 'fill', 'fill');
            const stroke = svgPaint(k, 'stroke', 'stroke');
            if (!fill && !stroke) continue;
            elements.push({ type: 'box', fromSvg: true,
              shape: tag === 'rect' ? 'rect' : 'ellipse',
              x: NX(kr.left), y: NY(kr.top), w: N(kr.width), h: N(kr.height),
              z: zPathOf(el), ord: ord++,
              fill: fill ? { type: 'solid', color: fill.color,
                alpha: Math.round(fill.alpha * opacity * 100) / 100 } : null,
              radius: 0,
              border: stroke ? { color: stroke.color, alpha: stroke.alpha,
                width: N(parseFloat(getComputedStyle(k).strokeWidth) || 1) } : null,
              shadow: null });
          }
        }
        return;
      }
      elements.push({ type: 'svgPicture', ...base(el, r), domId: tagFor(el),
        svgMarkup: el.outerHTML });
    }

    function visit(el, opacity) {
      if (!isVisible(el)) return;
      const cs = getComputedStyle(el);
      opacity *= parseFloat(cs.opacity);
      if (opacity < 0.02) return;
      const r = el.getBoundingClientRect();
      const tag = el.tagName;

      if (tag === 'IMG') { pushImage(el, cs, r, opacity); return; }
      if (tag.toLowerCase() === 'svg') { pushSvg(el, r, opacity); return; }

      // own background paints first, then ::before (a pseudo-child)
      pushBoxIfPainted(el, cs, r, opacity);
      pushPseudo(el, '::before', r, opacity);

      if (tag === 'UL' || tag === 'OL') pushList(el, cs, r, opacity);
      else if (isTextBlock(el)) pushText(el, cs, r, opacity);
      else for (const child of el.children) visit(child, opacity);

      pushPseudo(el, '::after', r, opacity);
    }

    visit(frame, 1);

    elements.sort((a, b) => {
      const za = a.z || [], zb = b.z || [];
      for (let i = 0; i < Math.max(za.length, zb.length); i++) {
        const d = (za[i] ?? 0) - (zb[i] ?? 0);
        if (d) return d;
      }
      return a.ord - b.ord;
    });

    const signature = elements.map(e => [
      e.type, Math.round(e.x || e.x1 || 0), Math.round(e.y || e.y1 || 0), Math.round(e.w || 0),
      e.paragraphs ? e.paragraphs.map(p => p.runs.map(r => r.text).join('')).join('|') : '',
    ].join(',')).join(';');

    return {
      frame: { x: fr.left, y: fr.top, w: fr.width, h: fr.height },
      elements, signature,
    };
  };
})();
