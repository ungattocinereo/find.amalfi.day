/**
 * Generates route HTML pages from route definitions.
 * Run: node scripts/generate-html.mjs
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Inline SVG for map-pin (avoids FOUC before Lucide loads)
const MAP_PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>`;

// Inline SVG for arrow-left (back button, avoids FOUC)
const ARROW_LEFT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>`;

const routes = [
  {
    file: 'route/amalfi-house.html',
    title: 'Amalfi → Greg\'s House',
    titleKey: 'routes.amalfi_house',
    backUrl: '/',
    routeId: 'amalfi-house',
    segments: [
      { id: 'seg-a', count: 13, label: null },
      { id: 'seg-b', count: 20, imgStart: 1, dividerKey: 'common.now_in_atrani', dividerText: 'You are now entering Atrani' },
    ],
    arrivalKey: 'house.arrived',
    arrivalText: 'Welcome to Greg\'s House!',
    arrivalDetail: 'You\'ve made it. Time to relax.',
    arrivalIcon: 'home',
  },
  {
    file: 'route/atrani-house.html',
    title: 'Atrani → Greg\'s House',
    titleKey: 'routes.atrani_house',
    backUrl: '/',
    routeId: 'atrani-house',
    segments: [
      { id: 'seg-b-alt', count: 7, imgStart: 1, label: null },
      { id: 'seg-b', count: 14, imgStart: 7, dividerKey: 'common.entering_tunnel_route', dividerText: 'Continue through the village' },
    ],
    arrivalKey: 'house.arrived',
    arrivalText: 'Welcome to Greg\'s House!',
    arrivalDetail: 'You\'ve made it. Time to relax.',
    arrivalIcon: 'home',
  },
  {
    file: 'route/amalfi-awesome.html',
    title: 'Amalfi → Meeting Point',
    titleKey: 'routes.amalfi_awesome',
    backUrl: '/a/',
    routeId: 'amalfi-awesome',
    segments: [
      { id: 'seg-a', count: 13, label: null },
      { id: 'seg-c', count: 2, imgStart: 1, dividerKey: 'common.now_in_atrani', dividerText: 'You are now entering Atrani' },
    ],
    arrivalKey: 'awesome.arrived',
    arrivalText: 'You\'ve reached the Meeting Point!',
    arrivalDetail: 'Welcome! Look for Greg nearby.',
    arrivalIcon: 'party-popper',
  },
];

function pad(n) {
  return String(n).padStart(2, '0');
}

function generateStepCard(stepNum, totalSteps, segId, imgNum) {
  const imgPad = pad(imgNum);
  return `      <article class="step" id="step-${stepNum}">
        <div class="step-number"><i data-lucide="map-pin"></i> <span data-i18n="common.step">Step</span> ${stepNum} <span data-i18n="common.of">of</span> ${totalSteps}</div>
        <div class="step-photo">
          <div class="step-badge">
            ${MAP_PIN_SVG}
            <span>${stepNum}</span>
          </div>
          <picture>
            <source srcset="/img/${segId}/${imgPad}.webp" type="image/webp">
            <img src="/img/${segId}/${imgPad}.jpg" alt="" data-i18n-alt="steps.${segId}.${imgPad}.alt" loading="lazy" width="800" height="537">
          </picture>
        </div>
        <p class="step-caption" data-i18n="steps.${segId}.${imgPad}.caption"></p>
      </article>`;
}

function generatePage(route) {
  const totalSteps = route.segments.reduce((sum, seg) => sum + seg.count, 0);
  let stepNum = 0;
  let stepsHtml = '';

  for (const seg of route.segments) {
    if (seg.dividerKey) {
      stepsHtml += `\n      <div class="segment-divider">
        <span class="segment-divider-text" data-i18n="${seg.dividerKey}">${seg.dividerText}</span>
      </div>\n`;
    }

    const imgStart = seg.imgStart || 1;
    for (let i = 0; i < seg.count; i++) {
      stepNum++;
      stepsHtml += generateStepCard(stepNum, totalSteps, seg.id, imgStart + i) + '\n';
    }
  }

  return `<!DOCTYPE html>
<html lang="en" class="no-js">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="#FF5900">
  <title>${route.title} | find.amalfi.day</title>
  <link rel="stylesheet" href="/css/style.css">
  <link rel="manifest" href="/manifest.json">
  <link rel="icon" href="/favicon.ico">
  <link rel="apple-touch-icon" href="/icons/icon-192.png">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <script>document.documentElement.classList.remove('no-js');</script>
</head>
<body>
  <header class="route-header">
    <a href="${route.backUrl}" class="back-link">${ARROW_LEFT_SVG} <span data-i18n="common.back">Back</span></a>
    <span class="route-name" data-i18n="${route.titleKey}">${route.title}</span>
    <nav class="lang-switcher" aria-label="Language">
      <button class="lang-btn active" data-lang="en">EN</button>
      <button class="lang-btn" data-lang="it">IT</button>
      <button class="lang-btn" data-lang="de">DE</button>
      <button class="lang-btn" data-lang="fr">FR</button>
    </nav>
  </header>

  <div class="progress-bar">
    <div class="progress-fill" id="progress-fill"></div>
  </div>

  <main class="steps" data-route="${route.routeId}" data-total="${totalSteps}">
${stepsHtml}
    <div class="arrival-card">
      <div class="arrival-icon"><i data-lucide="${route.arrivalIcon}"></i></div>
      <h2 class="arrival-title" data-i18n="${route.arrivalKey}">${route.arrivalText}</h2>
      <p class="arrival-text">${route.arrivalDetail}</p>
    </div>
  </main>

  <footer class="route-footer">
    <button class="btn-nav btn-prev" id="btn-prev" disabled>
      <i data-lucide="chevron-left"></i> <span data-i18n="common.prev">Back</span>
    </button>
    <button class="btn-download" id="btn-pdf" title="Download PDF">
      <i data-lucide="download"></i> <span data-i18n="common.download_pdf">PDF</span>
    </button>
    <button class="btn-nav btn-next" id="btn-next">
      <span data-i18n="common.next">Next</span> <i data-lucide="chevron-right"></i>
    </button>
  </footer>

  <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
  <script src="/js/app.js"></script>
</body>
</html>`;
}

// Generate all route pages
mkdirSync(join(ROOT, 'route'), { recursive: true });

for (const route of routes) {
  const html = generatePage(route);
  const outPath = join(ROOT, route.file);
  writeFileSync(outPath, html, 'utf-8');
  console.log(`Generated: ${route.file} (${route.segments.reduce((s, seg) => s + seg.count, 0)} steps)`);
}

console.log('\nDone!');
