/**
 * Generates printable PDF guides for each route × language.
 *
 * Run: npm run pdf
 *
 * Output: /pdf/{routeId}-{lang}.pdf
 *
 * Uses pdf-lib + fontkit for Unicode support (Cyrillic, CJK) and sharp for
 * image resizing. Fonts live in scripts/fonts/ (gitignored, download via
 * download-fonts.mjs or the inline fallback below).
 *
 *   - NotoSans-Regular.ttf       → Latin + Cyrillic + Greek (en/it/de/fr/ru)
 *   - NotoSansSC-VF.ttf          → Simplified Chinese (zh)
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
    segments: [
      { id: 'seg-a', count: 13, imgStart: 1 },
      { id: 'seg-b', count: 20, imgStart: 1, dividerKey: 'common.now_in_atrani' },
    ],
    arrivalKey: 'house.arrived',
    wifi: { ssid: 'Amalfi.Day', password: 'Z1x2c3v4' },
  },
  {
    id: 'atrani-house',
    titleKey: 'routes.atrani_house',
    segments: [
      { id: 'seg-b-alt', count: 7, imgStart: 1 },
      { id: 'seg-b', count: 14, imgStart: 7, dividerKey: 'common.entering_tunnel_route' },
    ],
    arrivalKey: 'house.arrived',
    wifi: { ssid: 'Amalfi.Day', password: 'Z1x2c3v4' },
  },
  {
    id: 'amalfi-awesome',
    titleKey: 'routes.amalfi_awesome',
    segments: [
      { id: 'seg-a', count: 13, imgStart: 1 },
      { id: 'seg-c', count: 2, imgStart: 1, dividerKey: 'common.now_in_atrani' },
    ],
    arrivalKey: 'awesome.arrived',
  },
];

const LANGS = ['en', 'it', 'de', 'fr', 'ru', 'zh'];

const PAGE_W = 595;   // A4 portrait @ 72pt
const PAGE_H = 842;
const MARGIN = 36;
const CONTENT_W = PAGE_W - MARGIN * 2;

function pad(n) { return String(n).padStart(2, '0'); }

function getNested(obj, path) {
  return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : null), obj);
}

function loadTranslations(lang) {
  return JSON.parse(readFileSync(join(ROOT, 'i18n', `${lang}.json`), 'utf-8'));
}

/** Wrap text to fit `maxWidth` using the embedded font's width measurements. */
function wrapText(font, text, size, maxWidth) {
  const lines = [];
  // Split on whitespace and also break long CJK runs (no spaces in Chinese)
  // by allowing breaking between any characters when needed.
  const words = text.split(/(\s+)/).filter(s => s.length > 0);
  let line = '';

  const measure = (s) => font.widthOfTextAtSize(s, size);

  for (const word of words) {
    if (/^\s+$/.test(word)) {
      line += word;
      continue;
    }
    // Fits on current line?
    if (measure(line + word) <= maxWidth) {
      line += word;
      continue;
    }
    // Doesn't fit. If line has content, flush.
    if (line.trim()) {
      lines.push(line.trimEnd());
      line = '';
    }
    // Word itself might be wider than maxWidth (long CJK run). Split char-by-char.
    if (measure(word) > maxWidth) {
      let chunk = '';
      for (const ch of word) {
        if (measure(chunk + ch) > maxWidth) {
          lines.push(chunk);
          chunk = ch;
        } else {
          chunk += ch;
        }
      }
      line = chunk;
    } else {
      line = word;
    }
  }
  if (line.trim()) lines.push(line.trimEnd());
  return lines;
}

async function loadStepImage(segId, imgNum) {
  const candidates = [
    join(ROOT, 'img', segId, `${pad(imgNum)}.webp`),
    join(ROOT, 'img', segId, `${pad(imgNum)}.jpg`),
  ];
  const src = candidates.find(p => existsSync(p));
  if (!src) throw new Error(`Image not found: ${segId}/${pad(imgNum)}`);
  return sharp(src)
    .resize({ width: 600, withoutEnlargement: true })
    .jpeg({ quality: 72, mozjpeg: true })
    .toBuffer();
}

/** Pick the font best suited for a language. */
function fontForLang(lang) {
  if (lang === 'zh') return join(FONTS, 'NotoSansSC-VF.ttf');
  return join(FONTS, 'NotoSans-Regular.ttf');
}

function ensureFonts() {
  const required = ['NotoSans-Regular.ttf', 'NotoSansSC-VF.ttf'];
  const missing = required.filter(f => !existsSync(join(FONTS, f)));
  if (missing.length) {
    console.error(`Missing fonts: ${missing.join(', ')}`);
    console.error(`Place them in ${FONTS}/ and re-run.`);
    process.exit(1);
  }
}

async function buildPdf(route, lang) {
  const t = loadTranslations(lang);
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  const fontBytes = readFileSync(fontForLang(lang));
  const font = await pdf.embedFont(fontBytes, { subset: true });

  const totalSteps = route.segments.reduce((s, seg) => s + seg.count, 0);
  const routeTitle = getNested(t, route.titleKey) || route.id;
  const stepWord = getNested(t, 'common.step') || 'Step';
  const ofWord = getNested(t, 'common.of') || 'of';

  // Title page
  let page = pdf.addPage([PAGE_W, PAGE_H]);
  page.drawText(routeTitle, {
    x: MARGIN, y: PAGE_H - MARGIN - 40,
    size: 22, font,
    color: rgb(0.11, 0.18, 0.23),
  });
  page.drawText(`${totalSteps} ${stepWord} · find.amalfi.day`, {
    x: MARGIN, y: PAGE_H - MARGIN - 64,
    size: 10, font,
    color: rgb(0.42, 0.48, 0.52),
  });

  let stepNum = 0;
  let cursorY = PAGE_H - MARGIN - 100;

  for (const seg of route.segments) {
    if (seg.dividerKey) {
      const divider = getNested(t, seg.dividerKey) || '';
      page = pdf.addPage([PAGE_W, PAGE_H]);
      cursorY = PAGE_H - MARGIN;
      page.drawText(divider, {
        x: MARGIN, y: cursorY - 28,
        size: 16, font,
        color: rgb(1.0, 0.35, 0.0),
      });
      cursorY -= 58;
    }

    const imgStart = seg.imgStart || 1;
    for (let i = 0; i < seg.count; i++) {
      stepNum++;
      const imgPad = pad(imgStart + i);
      const caption = getNested(t, `steps.${seg.id}.${imgPad}.caption`) || '';

      const jpgBuf = await loadStepImage(seg.id, imgStart + i);
      const img = await pdf.embedJpg(jpgBuf);
      const imgW = Math.min(CONTENT_W, 420);
      const imgH = imgW * (img.height / img.width);

      const capLines = wrapText(font, caption, 10, CONTENT_W);
      const capLineH = 13;
      const capBlockH = capLines.length * capLineH;

      const stepHeaderH = 18;
      const blockH = stepHeaderH + 6 + imgH + 10 + capBlockH + 20;

      if (cursorY - blockH < MARGIN) {
        page = pdf.addPage([PAGE_W, PAGE_H]);
        cursorY = PAGE_H - MARGIN;
      }

      page.drawText(`${stepWord} ${stepNum} ${ofWord} ${totalSteps}`, {
        x: MARGIN, y: cursorY - 12,
        size: 9, font,
        color: rgb(1.0, 0.35, 0.0),
      });
      cursorY -= stepHeaderH;

      const imgX = MARGIN + (CONTENT_W - imgW) / 2;
      page.drawImage(img, { x: imgX, y: cursorY - imgH, width: imgW, height: imgH });
      cursorY -= imgH + 10;

      for (const line of capLines) {
        page.drawText(line, {
          x: MARGIN, y: cursorY - 11,
          size: 10, font,
          color: rgb(0.11, 0.18, 0.23),
        });
        cursorY -= capLineH;
      }
      cursorY -= 18;
    }
  }

  // Arrival page
  page = pdf.addPage([PAGE_W, PAGE_H]);
  const arrivalTitle = getNested(t, route.arrivalKey) || 'You have arrived!';
  let y = PAGE_H / 2 + 40;
  page.drawText(arrivalTitle, {
    x: MARGIN, y,
    size: 20, font,
    color: rgb(1.0, 0.35, 0.0),
  });
  y -= 24;

  const arrivalTextKey = route.arrivalKey.replace(/\.arrived$/, '.arrival_text');
  const arrivalBody = getNested(t, arrivalTextKey);
  if (arrivalBody) {
    const lines = wrapText(font, arrivalBody, 11, CONTENT_W);
    for (const line of lines) {
      page.drawText(line, {
        x: MARGIN, y,
        size: 11, font,
        color: rgb(0.11, 0.18, 0.23),
      });
      y -= 15;
    }
    y -= 10;
  }

  if (route.wifi) {
    const wifiLabel = getNested(t, 'common.wifi') || 'Wi-Fi';
    const netLabel = getNested(t, 'common.network') || 'Network';
    const passLabel = getNested(t, 'common.password') || 'Password';
    page.drawText(wifiLabel, {
      x: MARGIN, y,
      size: 11, font,
      color: rgb(0.11, 0.18, 0.23),
    });
    y -= 16;
    page.drawText(`${netLabel}: ${route.wifi.ssid}`, {
      x: MARGIN, y,
      size: 11, font,
      color: rgb(0.42, 0.48, 0.52),
    });
    y -= 15;
    page.drawText(`${passLabel}: ${route.wifi.password}`, {
      x: MARGIN, y,
      size: 11, font,
      color: rgb(0.42, 0.48, 0.52),
    });
  }

  // Footer
  const pageCount = pdf.getPageCount();
  for (let i = 0; i < pageCount; i++) {
    const p = pdf.getPage(i);
    p.drawText(`${routeTitle} (${lang.toUpperCase()}) · ${i + 1} / ${pageCount}`, {
      x: MARGIN, y: 18,
      size: 7, font,
      color: rgb(0.55, 0.6, 0.65),
    });
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
