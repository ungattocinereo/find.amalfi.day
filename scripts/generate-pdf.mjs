/**
 * Generates printable PDF guides for each route × language.
 *
 * Run: npm run pdf
 * Output: /pdf/{routeId}-{lang}.pdf
 *
 * Design: magazine-style cover + 2-up grid of photo cards with captions.
 *
 * Font strategy: always embed NotoSans-Regular (Latin + Cyrillic) and, for zh,
 * also embed NotoSansSC-VF for CJK glyphs. Every drawText / width call goes
 * through a mixed-font renderer that routes each codepoint to the correct font.
 * This works around a pdf-lib subsetting bug where NotoSansSC-VF drops most
 * Latin glyphs when subsetted on its own.
 */
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const FONTS = join(__dirname, 'fonts');

const ROUTES = [
  {
    id: 'amalfi-house',
    titleKey: 'routes.amalfi_house',
    subtitleKey: 'house.subtitle',
    tldrKey: 'house.tldr',
    segments: [
      { id: 'seg-a', count: 13, imgStart: 1 },
      { id: 'seg-b', count: 20, imgStart: 1, dividerKey: 'common.now_in_atrani' },
    ],
    arrivalKey: 'house.arrived',
    arrivalTextKey: 'house.arrival_text',
    wifi: { ssid: 'Amalfi.Day', password: 'Z1x2c3v4' },
  },
  {
    id: 'atrani-house',
    titleKey: 'routes.atrani_house',
    subtitleKey: 'house.subtitle',
    tldrKey: 'house.tldr',
    segments: [
      { id: 'seg-b-alt', count: 7, imgStart: 1 },
      { id: 'seg-b', count: 14, imgStart: 7, dividerKey: 'common.entering_tunnel_route' },
    ],
    arrivalKey: 'house.arrived',
    arrivalTextKey: 'house.arrival_text',
    wifi: { ssid: 'Amalfi.Day', password: 'Z1x2c3v4' },
  },
  {
    id: 'amalfi-awesome',
    titleKey: 'routes.amalfi_awesome',
    subtitleKey: 'awesome.subtitle',
    tldrKey: 'awesome.tldr',
    segments: [
      { id: 'seg-a', count: 13, imgStart: 1 },
      { id: 'seg-c', count: 2, imgStart: 1, dividerKey: 'common.now_in_atrani' },
    ],
    arrivalKey: 'awesome.arrived',
    arrivalTextKey: 'awesome.arrival_text',
  },
];

const LANGS = ['en', 'it', 'de', 'fr', 'ru', 'zh'];

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN_X = 40;
const MARGIN_BOTTOM = 48;
const GUTTER = 20;
const CARD_W = (PAGE_W - MARGIN_X * 2 - GUTTER) / 2;

const PHOTO_RATIO = 3 / 4;
const PHOTO_H = CARD_W * PHOTO_RATIO;

const TYPE = {
  coverTitle: 30,
  coverSubtitle: 12,
  coverTldr: 11,
  routeMeta: 9,
  dividerBig: 20,
  arrivalTitle: 26,
  arrivalBody: 12,
  stepBadge: 10,
  caption: 9.5,
  wifiLabel: 11,
  wifiValue: 12,
  footer: 8,
};
const LINE = 1.35;

const COL = {
  orange:     rgb(0.96, 0.38, 0.08),
  orangeDeep: rgb(0.78, 0.28, 0.04),
  orangeSoft: rgb(1.00, 0.93, 0.85),
  slate:      rgb(0.11, 0.18, 0.23),
  slateMid:   rgb(0.35, 0.42, 0.48),
  slateLight: rgb(0.58, 0.64, 0.70),
  paper:      rgb(0.985, 0.975, 0.955),
  card:       rgb(1.00, 1.00, 1.00),
  border:     rgb(0.88, 0.86, 0.82),
  white:      rgb(1, 1, 1),
};

function pad(n) { return String(n).padStart(2, '0'); }

function getNested(obj, path) {
  return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : null), obj);
}

function loadTranslations(lang) {
  return JSON.parse(readFileSync(join(ROOT, 'i18n', `${lang}.json`), 'utf-8'));
}

/* --- Dual-font rendering ------------------------------------------------- */

/** Returns true for codepoints that should be rendered with the CJK font. */
function isCJK(cp) {
  return (
    (cp >= 0x2E80 && cp <= 0x303F) ||   // CJK Radicals + Symbols and Punctuation
    (cp >= 0x3400 && cp <= 0x4DBF) ||   // CJK Extension A
    (cp >= 0x4E00 && cp <= 0x9FFF) ||   // CJK Unified Ideographs
    (cp >= 0xF900 && cp <= 0xFAFF) ||   // CJK Compatibility Ideographs
    (cp >= 0xFF00 && cp <= 0xFFEF)      // Halfwidth/Fullwidth
  );
}

/** Pick a font for a single codepoint from a FontPair. */
function pickFont(fonts, cp) {
  return fonts.cjk && isCJK(cp) ? fonts.cjk : fonts.latin;
}

/** Split text into contiguous runs that share the same font. */
function runs(fonts, text) {
  const out = [];
  let run = '';
  let runFont = null;
  const chars = Array.from(text); // handle surrogates
  for (const ch of chars) {
    const cp = ch.codePointAt(0);
    const f = pickFont(fonts, cp);
    if (runFont && f !== runFont) { out.push({ font: runFont, text: run }); run = ''; }
    runFont = f;
    run += ch;
  }
  if (run) out.push({ font: runFont, text: run });
  return out;
}

function widthOf(fonts, text, size) {
  let w = 0;
  for (const r of runs(fonts, text)) w += r.font.widthOfTextAtSize(r.text, size);
  return w;
}

/** Draw mixed-font text at (x, y). Returns total width drawn. */
function drawText(page, text, { x, y, size, fonts, color }) {
  let cursor = x;
  for (const r of runs(fonts, text)) {
    page.drawText(r.text, { x: cursor, y, size, font: r.font, color });
    cursor += r.font.widthOfTextAtSize(r.text, size);
  }
  return cursor - x;
}

/** Faux-bold: two passes with a small horizontal offset. */
function drawStrong(page, text, opts) {
  drawText(page, text, opts);
  drawText(page, text, { ...opts, x: opts.x + 0.35 });
}

/* --- Text wrapping ------------------------------------------------------- */

/** Wrap using mixed-font metrics. CJK text has no spaces — char-split. */
function wrapText(fonts, text, size, maxWidth) {
  const lines = [];
  const words = text.split(/(\s+)/).filter(s => s.length > 0);
  let line = '';
  const W = (s) => widthOf(fonts, s, size);
  for (const word of words) {
    if (/^\s+$/.test(word)) { line += word; continue; }
    if (W(line + word) <= maxWidth) { line += word; continue; }
    if (line.trim()) { lines.push(line.trimEnd()); line = ''; }
    if (W(word) > maxWidth) {
      // Break the word character by character (long CJK run or unbreakable).
      let chunk = '';
      for (const ch of Array.from(word)) {
        if (W(chunk + ch) > maxWidth) { lines.push(chunk); chunk = ch; }
        else chunk += ch;
      }
      line = chunk;
    } else {
      line = word;
    }
  }
  if (line.trim()) lines.push(line.trimEnd());
  return lines;
}

function wrapClamp(fonts, text, size, maxWidth, maxLines) {
  const all = wrapText(fonts, text, size, maxWidth);
  if (all.length <= maxLines) return all;
  const kept = all.slice(0, maxLines);
  let last = kept[maxLines - 1];
  const ell = '…';
  while (last.length > 0 && widthOf(fonts, last + ell, size) > maxWidth) {
    last = last.slice(0, -1);
  }
  kept[maxLines - 1] = last.trimEnd() + ell;
  return kept;
}

/* --- Images -------------------------------------------------------------- */

async function loadStepImage(segId, imgNum) {
  const candidates = [
    join(ROOT, 'img', segId, `${pad(imgNum)}.webp`),
    join(ROOT, 'img', segId, `${pad(imgNum)}.jpg`),
  ];
  const src = candidates.find(p => existsSync(p));
  if (!src) throw new Error(`Image not found: ${segId}/${pad(imgNum)}`);
  return sharp(src)
    .resize({ width: 800, height: 600, fit: 'cover', position: 'centre' })
    .jpeg({ quality: 75, mozjpeg: true })
    .toBuffer();
}

function ensureFonts() {
  const required = ['NotoSans-Regular.ttf', 'NotoSansSC-VF.ttf'];
  const missing = required.filter(f => !existsSync(join(FONTS, f)));
  if (missing.length) {
    console.error(`Missing fonts: ${missing.join(', ')}`);
    process.exit(1);
  }
}

/* --- Drawing primitives -------------------------------------------------- */

function paintBackground(page) {
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: COL.paper });
}

/** Small right-pointing triangle, rendered as a shape (font-independent). */
function drawArrow(page, x, baselineY, size, color) {
  const h = size * 0.55;
  const w = size * 0.55;
  const cy = baselineY + size * 0.32;
  page.drawSvgPath(`M 0 ${-h / 2} L ${w} 0 L 0 ${h / 2} Z`, { x, y: cy, color });
}

/** Draw a title that may contain "→" — split and insert a shape arrow. */
function drawTitleWithArrow(page, text, { x, y, size, fonts, color }) {
  const parts = text.split('→');
  if (parts.length === 1) {
    drawStrong(page, text, { x, y, size, fonts, color });
    return widthOf(fonts, text, size);
  }
  const left = parts[0].trimEnd();
  const right = parts.slice(1).join('→').trimStart();
  drawStrong(page, left, { x, y, size, fonts, color });
  const leftW = widthOf(fonts, left, size);
  const gap = size * 0.4;
  drawArrow(page, x + leftW + gap, y, size, color);
  const arrowSpace = size * 0.55 + gap * 2;
  drawStrong(page, right, { x: x + leftW + arrowSpace, y, size, fonts, color });
  return leftW + arrowSpace + widthOf(fonts, right, size);
}

function drawRunningHeader(page, routeTitle, lang, fonts) {
  const y = PAGE_H - 26;
  const cleanTitle = routeTitle.replace(/\s*→\s*/g, ' · ');
  drawText(page, `${cleanTitle} · ${lang.toUpperCase()}`, {
    x: MARGIN_X, y, size: TYPE.routeMeta, fonts, color: COL.slateLight,
  });
  page.drawRectangle({
    x: MARGIN_X, y: y - 8, width: 28, height: 1.4, color: COL.orange,
  });
}

function drawFooter(page, pageNum, pageCount, fonts) {
  const text = `${pageNum} / ${pageCount}`;
  const w = widthOf(fonts, text, TYPE.footer);
  drawText(page, text, {
    x: PAGE_W - MARGIN_X - w, y: 22,
    size: TYPE.footer, fonts, color: COL.slateLight,
  });
  drawText(page, 'find.amalfi.day', {
    x: MARGIN_X, y: 22,
    size: TYPE.footer, fonts, color: COL.slateLight,
  });
}

/* --- Cards --------------------------------------------------------------- */

function measureCard(fonts, caption) {
  const capLines = wrapClamp(fonts, caption, TYPE.caption, CARD_W - 4, 4);
  const capH = capLines.length * TYPE.caption * LINE;
  return { height: PHOTO_H + 10 + capH + 14, lines: capLines };
}

function drawCard(page, { x, y, stepNum, totalSteps, image, fonts, capLines }) {
  const photoY = y - PHOTO_H;
  page.drawImage(image, { x, y: photoY, width: CARD_W, height: PHOTO_H });
  page.drawRectangle({
    x, y: photoY, width: CARD_W, height: PHOTO_H,
    borderColor: COL.border, borderWidth: 0.5,
  });

  // Step badge (pill in the photo's top-left corner)
  const badgeText = `${String(stepNum).padStart(2, '0')} / ${String(totalSteps).padStart(2, '0')}`;
  const padX = 8;
  const badgeH = 17;
  const badgeW = widthOf(fonts, badgeText, TYPE.stepBadge) + padX * 2;
  const bx = x + 8;
  const by = y - 8 - badgeH;
  page.drawRectangle({ x: bx, y: by, width: badgeW, height: badgeH, color: COL.orange });
  drawText(page, badgeText, {
    x: bx + padX, y: by + 5,
    size: TYPE.stepBadge, fonts, color: COL.white,
  });

  // Caption under the photo
  let capY = photoY - 10;
  for (const line of capLines) {
    drawText(page, line, {
      x, y: capY - TYPE.caption,
      size: TYPE.caption, fonts, color: COL.slate,
    });
    capY -= TYPE.caption * LINE;
  }
}

/* --- Cover, divider, arrival -------------------------------------------- */

function drawCover(page, { routeTitle, subtitle, tldr, totalSteps, lang, stepWord, fonts }) {
  paintBackground(page);

  const bandH = 140;
  page.drawRectangle({ x: 0, y: PAGE_H - bandH, width: PAGE_W, height: bandH, color: COL.orange });
  page.drawRectangle({ x: 0, y: PAGE_H - bandH - 4, width: PAGE_W, height: 4, color: COL.orangeDeep });

  // Brand — always in Latin font (forced).
  drawStrong(page, 'find.amalfi.day', {
    x: MARGIN_X, y: PAGE_H - 56,
    size: 14, fonts: { latin: fonts.latin }, color: COL.white,
  });

  const tag = lang.toUpperCase();
  const tagW = widthOf({ latin: fonts.latin }, tag, 10);
  drawText(page, tag, {
    x: PAGE_W - MARGIN_X - tagW, y: PAGE_H - 56,
    size: 10, fonts: { latin: fonts.latin }, color: COL.orangeSoft,
  });

  // Decorative tick marks
  for (let i = 0; i < 3; i++) {
    page.drawRectangle({
      x: MARGIN_X + i * 14, y: PAGE_H - 78,
      width: 8, height: 2, color: COL.orangeSoft,
    });
  }

  // Title
  let y = PAGE_H - bandH - 70;
  drawTitleWithArrow(page, routeTitle, {
    x: MARGIN_X, y, size: TYPE.coverTitle, fonts, color: COL.slate,
  });
  y -= TYPE.coverTitle * 1.15;

  if (subtitle) {
    y -= 6;
    for (const line of wrapText(fonts, subtitle, TYPE.coverSubtitle, PAGE_W - MARGIN_X * 2)) {
      drawText(page, line, {
        x: MARGIN_X, y, size: TYPE.coverSubtitle, fonts, color: COL.slateMid,
      });
      y -= TYPE.coverSubtitle * LINE;
    }
  }

  y -= 14;
  page.drawRectangle({ x: MARGIN_X, y, width: 56, height: 3, color: COL.orange });
  y -= 22;

  if (tldr) {
    const boxPad = 16;
    const boxW = PAGE_W - MARGIN_X * 2;
    const lines = wrapText(fonts, tldr, TYPE.coverTldr, boxW - boxPad * 2);
    const boxH = boxPad * 2 + lines.length * TYPE.coverTldr * LINE;
    const boxY = y - boxH;
    page.drawRectangle({
      x: MARGIN_X, y: boxY, width: boxW, height: boxH,
      color: COL.card, borderColor: COL.border, borderWidth: 0.6,
    });
    page.drawRectangle({
      x: MARGIN_X, y: boxY, width: 3, height: boxH, color: COL.orange,
    });
    let ty = y - boxPad;
    for (const line of lines) {
      drawText(page, line, {
        x: MARGIN_X + boxPad, y: ty - TYPE.coverTldr,
        size: TYPE.coverTldr, fonts, color: COL.slate,
      });
      ty -= TYPE.coverTldr * LINE;
    }
    y = boxY - 22;
  }

  drawStrong(page, `${totalSteps} ${stepWord}`, {
    x: MARGIN_X, y, size: 13, fonts, color: COL.orangeDeep,
  });
}

function drawDivider(page, { text, fonts }) {
  paintBackground(page);

  const slabH = 190;
  const slabY = (PAGE_H - slabH) / 2;
  page.drawRectangle({
    x: 0, y: slabY, width: PAGE_W, height: slabH, color: COL.orange,
  });

  const lines = wrapText(fonts, text, TYPE.dividerBig, PAGE_W - MARGIN_X * 2);
  const totalH = lines.length * TYPE.dividerBig * 1.3;
  let ty = slabY + slabH / 2 + totalH / 2 - TYPE.dividerBig;
  for (const line of lines) {
    const w = widthOf(fonts, line, TYPE.dividerBig);
    drawStrong(page, line, {
      x: (PAGE_W - w) / 2, y: ty,
      size: TYPE.dividerBig, fonts, color: COL.white,
    });
    ty -= TYPE.dividerBig * 1.3;
  }

  const dotY = slabY + slabH / 2 - totalH / 2 - 16;
  for (let i = 0; i < 5; i++) {
    page.drawCircle({
      x: PAGE_W / 2 - 24 + i * 12, y: dotY,
      size: 2, color: COL.orangeSoft,
    });
  }
}

function drawArrival(page, { title, body, wifi, wifiLabels, fonts }) {
  paintBackground(page);

  const bandH = 90;
  page.drawRectangle({ x: 0, y: PAGE_H - bandH, width: PAGE_W, height: bandH, color: COL.orange });
  page.drawRectangle({ x: 0, y: PAGE_H - bandH - 3, width: PAGE_W, height: 3, color: COL.orangeDeep });

  let y = PAGE_H - bandH - 40;
  for (const line of wrapText(fonts, title, TYPE.arrivalTitle, PAGE_W - MARGIN_X * 2)) {
    drawStrong(page, line, {
      x: MARGIN_X, y, size: TYPE.arrivalTitle, fonts, color: COL.slate,
    });
    y -= TYPE.arrivalTitle * 1.15;
  }

  y -= 8;
  page.drawRectangle({ x: MARGIN_X, y, width: 56, height: 3, color: COL.orange });
  y -= 22;

  if (body) {
    for (const line of wrapText(fonts, body, TYPE.arrivalBody, PAGE_W - MARGIN_X * 2)) {
      drawText(page, line, {
        x: MARGIN_X, y, size: TYPE.arrivalBody, fonts, color: COL.slate,
      });
      y -= TYPE.arrivalBody * LINE;
    }
    y -= 14;
  }

  if (wifi) {
    const boxW = PAGE_W - MARGIN_X * 2;
    const boxH = 96;
    const boxY = y - boxH;
    page.drawRectangle({
      x: MARGIN_X, y: boxY, width: boxW, height: boxH,
      color: COL.card, borderColor: COL.orange, borderWidth: 1.2,
    });
    page.drawRectangle({
      x: MARGIN_X, y: boxY + boxH - 4, width: boxW, height: 4, color: COL.orange,
    });

    drawStrong(page, wifiLabels.wifi, {
      x: MARGIN_X + 18, y: boxY + boxH - 28,
      size: TYPE.wifiLabel + 2, fonts, color: COL.slate,
    });

    drawText(page, wifiLabels.network, {
      x: MARGIN_X + 18, y: boxY + boxH - 52,
      size: TYPE.wifiLabel, fonts, color: COL.slateMid,
    });
    drawText(page, wifi.ssid, {
      x: MARGIN_X + 110, y: boxY + boxH - 52,
      size: TYPE.wifiValue, fonts, color: COL.slate,
    });

    drawText(page, wifiLabels.password, {
      x: MARGIN_X + 18, y: boxY + boxH - 72,
      size: TYPE.wifiLabel, fonts, color: COL.slateMid,
    });
    drawStrong(page, wifi.password, {
      x: MARGIN_X + 110, y: boxY + boxH - 72,
      size: TYPE.wifiValue, fonts, color: COL.orangeDeep,
    });
  }
}

/* --- Builder ------------------------------------------------------------- */

async function buildPdf(route, lang) {
  const t = loadTranslations(lang);
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  // Always embed the Latin font; embed the CJK font only for zh.
  const latin = await pdf.embedFont(
    readFileSync(join(FONTS, 'NotoSans-Regular.ttf')),
    { subset: true },
  );
  // NOTE: pdf-lib/fontkit subsetting mangles glyphs from variable fonts such
  // as NotoSansSC-VF (most Latin + many Han glyphs get dropped). Embed the
  // full font instead. Bloats the zh PDF by ~8 MB but guarantees coverage.
  const cjk = lang === 'zh'
    ? await pdf.embedFont(
        readFileSync(join(FONTS, 'NotoSansSC-VF.ttf')),
        { subset: false },
      )
    : null;
  const fonts = { latin, cjk };

  const totalSteps = route.segments.reduce((s, seg) => s + seg.count, 0);
  const routeTitle = getNested(t, route.titleKey) || route.id;
  const subtitle = route.subtitleKey ? getNested(t, route.subtitleKey) : null;
  const tldr = route.tldrKey ? getNested(t, route.tldrKey) : null;
  const stepWord = getNested(t, 'common.step') || 'Step';
  const stepsWord = getNested(t, 'common.steps') || 'Steps';
  const stepsLabel = stepsWord.toLowerCase() === 'step' ? stepWord : stepsWord;

  // Collect all items (divider + cards) with captions + pre-embedded photos.
  const items = [];
  let stepIdx = 0;
  for (const seg of route.segments) {
    if (seg.dividerKey) {
      items.push({ kind: 'divider', text: getNested(t, seg.dividerKey) || '' });
    }
    const imgStart = seg.imgStart || 1;
    for (let i = 0; i < seg.count; i++) {
      stepIdx++;
      const imgPad = pad(imgStart + i);
      const caption = getNested(t, `steps.${seg.id}.${imgPad}.caption`) || '';
      const jpgBuf = await loadStepImage(seg.id, imgStart + i);
      const image = await pdf.embedJpg(jpgBuf);
      const { lines } = measureCard(fonts, caption);
      items.push({ kind: 'card', stepNum: stepIdx, image, capLines: lines });
    }
  }

  // Cover
  const coverPage = pdf.addPage([PAGE_W, PAGE_H]);
  drawCover(coverPage, {
    routeTitle, subtitle, tldr, totalSteps,
    lang, stepWord: stepsLabel, fonts,
  });

  // Content grid (2×N)
  const ROW_H = PHOTO_H + 10 + 4 * TYPE.caption * LINE + 18;
  const PAGE_CONTENT_TOP = PAGE_H - 60;
  const PAGE_CONTENT_BOTTOM = MARGIN_BOTTOM + 6;

  let currentPage = null;
  let cursorY = 0;
  let col = 0;

  const newContentPage = () => {
    currentPage = pdf.addPage([PAGE_W, PAGE_H]);
    paintBackground(currentPage);
    drawRunningHeader(currentPage, routeTitle, lang, fonts);
    cursorY = PAGE_CONTENT_TOP;
    col = 0;
  };

  for (const it of items) {
    if (it.kind === 'divider') {
      const divPage = pdf.addPage([PAGE_W, PAGE_H]);
      drawDivider(divPage, { text: it.text, fonts });
      currentPage = null;
      continue;
    }
    if (!currentPage) newContentPage();
    if (col === 0 && cursorY - ROW_H < PAGE_CONTENT_BOTTOM) newContentPage();

    const x = MARGIN_X + (col === 0 ? 0 : CARD_W + GUTTER);
    drawCard(currentPage, {
      x, y: cursorY,
      stepNum: it.stepNum, totalSteps,
      image: it.image, capLines: it.capLines, fonts,
    });
    if (col === 0) col = 1;
    else { col = 0; cursorY -= ROW_H; }
  }

  // Arrival
  const arrivalPage = pdf.addPage([PAGE_W, PAGE_H]);
  drawArrival(arrivalPage, {
    title: getNested(t, route.arrivalKey) || 'You have arrived!',
    body: route.arrivalTextKey ? getNested(t, route.arrivalTextKey) : null,
    wifi: route.wifi,
    wifiLabels: {
      wifi: getNested(t, 'common.wifi') || 'Wi-Fi',
      network: getNested(t, 'common.network') || 'Network',
      password: getNested(t, 'common.password') || 'Password',
    },
    fonts,
  });

  // Footer on every page
  const count = pdf.getPageCount();
  for (let i = 0; i < count; i++) {
    drawFooter(pdf.getPage(i), i + 1, count, fonts);
  }

  return pdf.save();
}

async function main() {
  ensureFonts();

  const pdfDir = join(ROOT, 'pdf');
  if (!existsSync(pdfDir)) mkdirSync(pdfDir, { recursive: true });

  for (const route of ROUTES) {
    for (const lang of LANGS) {
      try {
        console.log(`→ Building ${route.id} (${lang})`);
        const bytes = await buildPdf(route, lang);
        const out = join(pdfDir, `${route.id}-${lang}.pdf`);
        writeFileSync(out, bytes);
        const kb = (bytes.length / 1024).toFixed(0);
        console.log(`  ✓ ${out} (${kb} KB)`);
      } catch (err) {
        console.error(`  ✗ ${route.id}-${lang}: ${err.message}`);
      }
    }
  }
  console.log('\nDone.');
}

main().catch(err => { console.error(err); process.exit(1); });
