/**
 * Generates route HTML pages from route definitions.
 * Run: node scripts/generate-html.mjs
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const ARROW_LEFT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>`;

const GLOBE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`;

const CHEVRON_DOWN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide"><path d="m6 9 6 6 6-6"/></svg>`;

const VOLUME_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;

const VOLUME_SMALL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;

const MAP_PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>`;

// Language picker options — native names so users recognize their own language.
const LANG_OPTIONS = [
  { code: 'en', native: 'English' },
  { code: 'it', native: 'Italiano' },
  { code: 'de', native: 'Deutsch' },
  { code: 'fr', native: 'Français' },
  { code: 'ru', native: 'Русский' },
  { code: 'zh', native: '中文' },
];

function langPickerMarkup() {
  const options = LANG_OPTIONS.map(l => `        <button type="button" class="lang-option" data-lang="${l.code}">
          <span class="lang-option-code">${l.code.toUpperCase()}</span>
          <span class="lang-option-name">${l.native}</span>
        </button>`).join('\n');
  return `  <div class="lang-picker" id="lang-picker" aria-hidden="true" role="dialog" aria-label="Language">
    <div class="lang-picker-backdrop" data-lang-close></div>
    <div class="lang-picker-sheet">
      <div class="lang-picker-handle" data-lang-close></div>
      <h3 class="lang-picker-title" data-i18n="common.pick_language">Language</h3>
      <div class="lang-picker-list">
${options}
      </div>
    </div>
  </div>`;
}

function navHeaderMarkup({ backUrl, routeMode }) {
  const backAria = routeMode ? 'Back to home' : 'Home';
  return `  <header class="nav" id="nav">
    <a href="${backUrl}" class="nav-btn nav-back" aria-label="${backAria}">
      ${ARROW_LEFT_SVG}
    </a>
    <div class="nav-right">
      <button type="button" class="nav-lang-chip" id="nav-lang-chip" aria-label="Change language" aria-haspopup="dialog" aria-expanded="false">
        ${GLOBE_SVG}
        <span class="nav-lang-code" id="nav-lang-code">EN</span>
        ${CHEVRON_DOWN_SVG}
      </button>${routeMode ? `
      <button type="button" class="nav-btn nav-tts" id="tts-toggle" aria-label="Toggle auto-narration" aria-pressed="false">
        ${VOLUME_SVG}
      </button>` : ''}
    </div>
  </header>`;
}

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
    railSegments: [
      { id: 'amalfi', i18nKey: 'rail.amalfi', label: 'Amalfi', step: 1 },
      { id: 'atrani', i18nKey: 'rail.atrani', label: 'Atrani', step: 14 },
      { id: 'house', i18nKey: 'rail.house', label: 'House', step: 33 },
    ],
    arrivalKey: 'house.arrived',
    arrivalText: 'Welcome to Greg\'s House!',
    arrivalDetail: 'You\'ve made it. Time to relax.',
    arrivalIcon: 'home',
    wifi: { ssid: 'Amalfi.Day', password: 'Z1x2c3v4' },
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
    wifi: { ssid: 'Amalfi.Day', password: 'Z1x2c3v4' },
  },
  {
    file: 'route/amalfi-awesome.html',
    title: 'Amalfi → Meeting Point',
    titleKey: 'routes.amalfi_awesome',
    backUrl: '/a/',
    routeId: 'amalfi-awesome',
    segments: [
      { id: 'seg-a', count: 13, label: null },
      { id: 'seg-c', count: 1, imgStart: 5, dividerKey: 'common.now_in_atrani', dividerText: 'You are now entering Atrani' },
    ],
    railSegments: [
      { id: 'amalfi', i18nKey: 'rail.amalfi', label: 'Amalfi', step: 1 },
      { id: 'tunnel', i18nKey: 'rail.tunnel', label: 'Tunnel', step: 8 },
      { id: 'meeting', i18nKey: 'rail.meeting', label: 'Meeting Point', step: 14 },
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
          ${MAP_PIN_SVG}
          <span data-i18n="common.step">Step</span> ${stepNum} <span data-i18n="common.of">of</span> ${totalSteps}
          <button type="button" class="step-tts" aria-label="Read aloud" data-i18n-aria="common.read_aloud">
            ${VOLUME_SMALL_SVG}
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

function generateDrawerItems(route) {
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
  const railNodesHtml = route.railSegments.map((s) => {
    return `        <div class="rail-seg" data-segment="${s.id}" data-segment-step="${s.step}">
          <span class="rail-seg-dot"></span>
          <span class="rail-seg-label" data-i18n="${s.i18nKey}">${s.label}</span>
        </div>`;
  }).join('\n');

  const drawerItems = generateDrawerItems(route);

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
${navHeaderMarkup({ backUrl: route.backUrl, routeMode: true })}

  <div class="rail" id="rail" data-segments='${railSegmentsJson}'>
    <div class="rail-track">
      <div class="rail-track-fill" id="rail-fill"></div>
    </div>
    <div class="rail-content">
      <div class="rail-segs">
${railNodesHtml}
      </div>
      <div class="rail-counter">
        <span id="rail-step-num">1</span><span class="rail-counter-sep">/</span>${totalSteps}
      </div>
    </div>
  </div>

  <main class="steps" data-route="${route.routeId}" data-total="${totalSteps}">
${stepsHtml}
    <div class="arrival-card">
      <div class="arrival-icon"><i data-lucide="${route.arrivalIcon}"></i></div>
      <h2 class="arrival-title" data-i18n="${route.arrivalKey}">${route.arrivalText}</h2>
      <p class="arrival-text" data-i18n="${route.arrivalKey.replace(/\.arrived$/, '.arrival_text')}">${route.arrivalDetail}</p>${route.wifi ? `
      <div class="arrival-wifi">
        <div class="arrival-wifi-header">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide"><path d="M5 13a10 10 0 0 1 14 0"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M2 8.82a15 15 0 0 1 20 0"/><line x1="12" x2="12.01" y1="20" y2="20"/></svg>
          <span data-i18n="common.wifi">Wi-Fi</span>
        </div>
        <div class="arrival-wifi-details">
          <div class="arrival-wifi-row">
            <span class="arrival-wifi-label" data-i18n="common.network">Network</span>
            <span class="arrival-wifi-value">${route.wifi.ssid}</span>
          </div>
          <div class="arrival-wifi-row">
            <span class="arrival-wifi-label" data-i18n="common.password">Password</span>
            <button type="button" class="arrival-wifi-password" data-copy="${route.wifi.password}" aria-label="Copy password">
              <code>${route.wifi.password}</code>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide arrival-wifi-icon arrival-wifi-icon--copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide arrival-wifi-icon arrival-wifi-icon--check"><path d="M20 6 9 17l-5-5"/></svg>
            </button>
          </div>
        </div>
      </div>` : ''}
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

${langPickerMarkup()}

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

// Expose helpers for landing pages (they'll hand-inject the same nav)
export { navHeaderMarkup, langPickerMarkup };

console.log('\nDone!');
