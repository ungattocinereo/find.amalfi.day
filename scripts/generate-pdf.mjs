/**
 * Generates printable PDF guides for each route × language.
 *
 * Run: npm run pdf
 *
 * Output: /pdf/{routeId}-{lang}.pdf
 *
 * Uses pdf-lib (layout) + sharp (image resize/compress) so the resulting
 * PDFs are small (a few hundred KB each) instead of the 30+ MB blobs that
 * Chromium page-to-PDF produces when it embeds source-resolution photos.
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Mirror of the routes array in scripts/generate-html.mjs. Keep in sync.
const ROUTES = [
  {
    id: 'amalfi-house',
    titleKey: 'routes.amalfi_house',
    segments: [
      { id: 'seg-a', count: 13, imgStart: 1 },
      { id: 'seg-b', count: 20, imgStart: 1, dividerKey: 'common.now_in_atrani' },
    ],
    arrivalKey: 'house.arrived',
  },
  {
    id: 'atrani-house',
    titleKey: 'routes.atrani_house',
    segments: [
      { id: 'seg-b-alt', count: 7, imgStart: 1 },
      { id: 'seg-b', count: 14, imgStart: 7, dividerKey: 'common.entering_tunnel_route' },
    ],
    arrivalKey: 'house.arrived',
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

const LANGS = ['en', 'it', 'de', 'fr'];

// A4 portrait @ 72 PDF points
const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 36;
const CONTENT_W = PAGE_W - MARGIN * 2;

function pad(n) { return String(n).padStart(2, '0'); }

function getNested(obj, path) {
  return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : null), obj);
}

function loadTranslations(lang) {
  const p = join(ROOT, 'i18n', `${lang}.json`);
  return JSON.parse(readFileSync(p, 'utf-8'));
}

/** Rough text wrap for the embedded StandardFont (Helvetica). */
function wrapText(font, text, size, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? line + ' ' + word : word;
    const w = font.widthOfTextAtSize(candidate, size);
    if (w > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * pdf-lib's StandardFont.Helvetica only encodes WinAnsi, so non-ASCII chars
 * (é, à, ü, …) would fail. Transliterate to ASCII so the PDF doesn't crash.
 * A proper fix is embedding a Unicode TTF (e.g. DejaVu), but that adds ~300 KB
 * per PDF and complicates shipping. For a static route guide, ASCII-fold is fine.
 */
function ascii(text) {
  if (!text) return '';
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')          // strip diacritics
    .replace(/[“”„]/g, '"')
    .replace(/[‘’‚]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/·/g, '·'.charCodeAt(0) <= 255 ? '·' : '-')
    .replace(/€/g, 'EUR')
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/✓/g, 'v')
    // Strip any remaining non-WinAnsi
    .replace(/[^\x00-\xff]/g, '?');
}

async function loadStepImage(segId, imgNum) {
  const candidates = [
    join(ROOT, 'img', segId, `${pad(imgNum)}.webp`),
    join(ROOT, 'img', segId, `${pad(imgNum)}.jpg`),
  ];
  const src = candidates.find(p => existsSync(p));
  if (!src) throw new Error(`Image not found: ${segId}/${pad(imgNum)}`);

  // Normalize to JPEG @ 600px wide, quality 72 — ~30 KB/photo is plenty for print.
  return sharp(src)
    .resize({ width: 600, withoutEnlargement: true })
    .jpeg({ quality: 72, mozjpeg: true })
    .toBuffer();
}

async function buildPdf(route, lang) {
  const t = loadTranslations(lang);
  const pdf = await PDFDocument.create();
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdf.embedFont(StandardFonts.HelveticaOblique);

  const totalSteps = route.segments.reduce((s, seg) => s + seg.count, 0);
  const routeTitle = ascii(getNested(t, route.titleKey) || route.id);

  // Title page
  let page = pdf.addPage([PAGE_W, PAGE_H]);
  page.drawText(routeTitle, {
    x: MARGIN,
    y: PAGE_H - MARGIN - 40,
    size: 22,
    font: fontBold,
    color: rgb(0.11, 0.18, 0.23),
  });
  page.drawText(ascii(`${totalSteps} ${getNested(t, 'common.step') || 'Step'}s · find.amalfi.day`), {
    x: MARGIN,
    y: PAGE_H - MARGIN - 64,
    size: 10,
    font: fontRegular,
    color: rgb(0.42, 0.48, 0.52),
  });

  let stepNum = 0;
  let cursorY = PAGE_H - MARGIN - 100;

  for (const seg of route.segments) {
    if (seg.dividerKey) {
      const divider = ascii(getNested(t, seg.dividerKey) || '');
      // New page for a new segment
      page = pdf.addPage([PAGE_W, PAGE_H]);
      cursorY = PAGE_H - MARGIN;
      page.drawText(divider, {
        x: MARGIN,
        y: cursorY - 28,
        size: 16,
        font: fontItalic,
        color: rgb(1.0, 0.35, 0.0),
      });
      cursorY -= 58;
    }

    const imgStart = seg.imgStart || 1;
    for (let i = 0; i < seg.count; i++) {
      stepNum++;
      const imgPad = pad(imgStart + i);
      const capKey = `steps.${seg.id}.${imgPad}.caption`;
      const caption = ascii(getNested(t, capKey) || '');

      // Load and measure image
      const jpgBuf = await loadStepImage(seg.id, imgStart + i);
      const img = await pdf.embedJpg(jpgBuf);
      const imgW = Math.min(CONTENT_W, 420);
      const imgH = imgW * (img.height / img.width);

      // Wrap caption
      const capLines = wrapText(fontRegular, caption, 10, CONTENT_W);
      const capLineH = 13;
      const capBlockH = capLines.length * capLineH;

      const stepHeaderH = 18;
      const blockH = stepHeaderH + 6 + imgH + 10 + capBlockH + 20;

      // New page if it won't fit
      if (cursorY - blockH < MARGIN) {
        page = pdf.addPage([PAGE_W, PAGE_H]);
        cursorY = PAGE_H - MARGIN;
      }

      // Step header
      const stepLabel = ascii(`${getNested(t, 'common.step') || 'Step'} ${stepNum} ${getNested(t, 'common.of') || 'of'} ${totalSteps}`);
      page.drawText(stepLabel, {
        x: MARGIN,
        y: cursorY - 12,
        size: 9,
        font: fontBold,
        color: rgb(1.0, 0.35, 0.0),
      });
      cursorY -= stepHeaderH;

      // Image (centered)
      const imgX = MARGIN + (CONTENT_W - imgW) / 2;
      page.drawImage(img, {
        x: imgX,
        y: cursorY - imgH,
        width: imgW,
        height: imgH,
      });
      cursorY -= imgH + 10;

      // Caption
      for (const line of capLines) {
        page.drawText(line, {
          x: MARGIN,
          y: cursorY - 11,
          size: 10,
          font: fontRegular,
          color: rgb(0.11, 0.18, 0.23),
        });
        cursorY -= capLineH;
      }
      cursorY -= 18;
    }
  }

  // Arrival page
  page = pdf.addPage([PAGE_W, PAGE_H]);
  const arrivalTitle = ascii(getNested(t, route.arrivalKey) || 'You have arrived!');
  page.drawText(arrivalTitle, {
    x: MARGIN,
    y: PAGE_H / 2 + 20,
    size: 20,
    font: fontBold,
    color: rgb(1.0, 0.35, 0.0),
  });
  page.drawText(ascii('find.amalfi.day'), {
    x: MARGIN,
    y: PAGE_H / 2 - 10,
    size: 10,
    font: fontRegular,
    color: rgb(0.42, 0.48, 0.52),
  });

  // Footer (page numbers)
  const pageCount = pdf.getPageCount();
  for (let i = 0; i < pageCount; i++) {
    const p = pdf.getPage(i);
    p.drawText(ascii(`${routeTitle} (${lang.toUpperCase()}) · ${i + 1} / ${pageCount}`), {
      x: MARGIN,
      y: 18,
      size: 7,
      font: fontRegular,
      color: rgb(0.55, 0.6, 0.65),
    });
  }

  return pdf.save();
}

async function main() {
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

main().catch(err => {
  console.error(err);
  process.exit(1);
});
