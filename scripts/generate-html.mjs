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

// Inline SVG for volume icon (TTS button, avoids FOUC)
const VOLUME_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;

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
    // Rail nodes shown in the segmented progress indicator.
    // `step` is the step number that activates this node.
    railSegments: [
      { id: 'amalfi', i18nKey: 'rail.amalfi', label: 'Amalfi', step: 1 },
      { id: 'atrani', i18nKey: 'rail.atrani', label: 'Atrani', step: 14 },
      { id: 'house', i18nKey: 'rail.house', label: 'House', step: 33 },
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
    railSegments: [
      { id: 'bus_stop', i18nKey: 'rail.bus_stop', label: 'Bus stop', step: 1 },
      { id: 'village', i18nKey: 'rail.village', label: 'Village', step: 8 },
      { id: 'house', i18nKey: 'rail.house', label: 'House', step: 21 },
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
    railSegments: [
      { id: 'amalfi', i18nKey: 'rail.amalfi', label: 'Amalfi', step: 1 },
      { id: 'tunnel', i18nKey: 'rail.tunnel', label: 'Tunnel', step: 8 },
      { id: 'meeting', i18nKey: 'rail.meeting', label: 'Meeting Point', step: 15 },
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
  return `      <article class="step" id="step-${stepNum}" data-step="${stepNum}">
        <div class="step-number">
          <i data-lucide="map-pin"></i>
          <span data-i18n="common.step">Step</span> ${stepNum} <span data-i18n="common.of">of</span> ${totalSteps}
          <button type="button" class="step-tts" aria-label="Read aloud" data-i18n-aria="common.read_aloud" data-tts-target="steps.${segId}.${imgPad}.caption">
            ${VOLUME_SVG}
          </button>
        </div>
        <div class="step-photo" data-step-index="${stepNum}">
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

function generateDrawerItems(route, totalSteps) {
  let items = '';
  let stepNum = 0;
  for (const seg of route.segments) {
    const imgStart = seg.imgStart || 1;
    for (let i = 0; i < seg.count; i++) {
      stepNum++;
      const imgPad = pad(imgStart + i);
      items += `        <button type="button" class="drawer-item" data-jump-step="${stepNum}">
          <span class="drawer-item-num">${stepNum}</span>
          <span class="drawer-item-thumb">
            <picture>
              <source srcset="/img/${seg.id}/${imgPad}.webp" type="image/webp">
              <img src="/img/${seg.id}/${imgPad}.jpg" alt="" loading="lazy" width="120" height="80">
            </picture>
          </span>
          <span class="drawer-item-caption" data-i18n="steps.${seg.id}.${imgPad}.caption"></span>
        </button>\n`;
    }
  }
  return items;
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

  const railSegmentsJson = JSON.stringify(route.railSegments).replace(/'/g, '&#39;');
  const railNodesHtml = route.railSegments.map((s, i) => {
    return `      <div class="rail-node" data-segment="${s.id}" data-segment-step="${s.step}">
        <span class="rail-node-dot"></span>
        <span class="rail-node-label" data-i18n="${s.i18nKey}">${s.label}</span>
      </div>`;
  }).join('\n');

  const drawerItems = generateDrawerItems(route, totalSteps);

  const langButtons = `      <button class="lang-btn" data-lang="en">EN</button>
      <button class="lang-btn" data-lang="it">IT</button>
      <button class="lang-btn" data-lang="de">DE</button>
      <button class="lang-btn" data-lang="fr">FR</button>`;
  const headerLangSwitcher = `<nav class="lang-switcher" aria-label="Language">
${langButtons}
    </nav>`;
  const heroLangSwitcher = `<nav class="lang-switcher lang-switcher--hero" aria-label="Language">
${langButtons}
    </nav>`;

  return `<!DOCTYPE html>
<html lang="en" class="no-js">
<head>
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-1LGSD9NFN6"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-1LGSD9NFN6');
  </script>
  <!-- Vercel Web Analytics -->
  <script>
    window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
  </script>
  <script defer src="/_vercel/insights/script.js"></script>
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
<body class="route-body">
  <!-- Prominent language hero strip — visible only at top of page -->
  <div class="lang-hero" id="lang-hero">
    <span class="lang-hero-icon"><i data-lucide="globe"></i></span>
    <span class="lang-hero-label" data-i18n="common.language">Language</span>
    ${heroLangSwitcher}
  </div>
  <!-- Sentinel observed by JS to detect when lang-hero has scrolled out of view -->
  <div class="lang-hero-sentinel" aria-hidden="true"></div>

  <header class="route-header">
    <a href="${route.backUrl}" class="back-link" aria-label="Back">
      ${ARROW_LEFT_SVG}
      <span data-i18n="common.back">Back</span>
    </a>
    ${headerLangSwitcher}
    <button type="button" class="header-tts-toggle" id="tts-toggle" aria-label="Toggle auto-narration" data-i18n-aria="common.toggle_auto_read">
      ${VOLUME_SVG}
    </button>
  </header>

  <div class="progress-rail" id="progress-rail" data-segments='${railSegmentsJson}'>
    <div class="rail-track">
      <div class="rail-fill" id="rail-fill"></div>
    </div>
    <div class="rail-nodes">
${railNodesHtml}
    </div>
    <div class="rail-meta">
      <span class="rail-meta-step"><span data-i18n="common.step">Step</span> <span id="rail-step-num">1</span> <span data-i18n="common.of">of</span> ${totalSteps}</span>
      <span class="rail-meta-sep">·</span>
      <span class="rail-meta-segment" id="rail-segment-label"></span>
    </div>
  </div>

  <main class="steps" data-route="${route.routeId}" data-total="${totalSteps}">
${stepsHtml}
    <div class="arrival-card">
      <div class="arrival-icon"><i data-lucide="${route.arrivalIcon}"></i></div>
      <h2 class="arrival-title" data-i18n="${route.arrivalKey}">${route.arrivalText}</h2>
      <p class="arrival-text">${route.arrivalDetail}</p>
    </div>
  </main>

  <button type="button" class="drawer-fab" id="drawer-fab" aria-label="Show all steps" data-i18n-aria="common.steps_drawer">
    <i data-lucide="list"></i>
    <span data-i18n="common.steps">Steps</span>
  </button>

  <div class="drawer" id="steps-drawer" aria-hidden="true" role="dialog" aria-label="All steps">
    <div class="drawer-backdrop" data-drawer-close></div>
    <div class="drawer-sheet">
      <div class="drawer-handle" data-drawer-close></div>
      <div class="drawer-header">
        <h3 class="drawer-title" data-i18n="common.all_steps">All steps</h3>
        <button type="button" class="drawer-close" aria-label="Close" data-drawer-close>
          <i data-lucide="x"></i>
        </button>
      </div>
      <div class="drawer-list" id="drawer-list">
${drawerItems}      </div>
    </div>
  </div>

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
  <script src="/js/lightbox.js"></script>
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
