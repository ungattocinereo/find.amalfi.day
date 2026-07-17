import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROUTES = [
  'route/amalfi-house.html',
  'route/atrani-house.html',
  'route/amalfi-awesome.html',
];

function read(path) {
  return readFileSync(join(ROOT, path), 'utf8');
}

function section(html, selectorName, pattern) {
  const match = html.match(pattern);
  assert.ok(match, `${selectorName} section is missing`);
  return match[1];
}

function assertPdfPlacement(html, sourceName) {
  const drawer = section(
    html,
    `${sourceName} drawer`,
    /<div class="drawer" id="steps-drawer"[\s\S]*?<div class="drawer-header">([\s\S]*?)<div class="drawer-list"/,
  );
  const footer = section(
    html,
    `${sourceName} footer`,
    /<footer class="route-footer">([\s\S]*?)<\/footer>/,
  );

  assert.doesNotMatch(drawer, /id="btn-pdf"/, `${sourceName} duplicates PDF in drawer`);
  assert.match(footer, /class="footer-pdf" id="btn-pdf"/, `${sourceName} footer lacks PDF button`);
  assert.match(footer, /data-i18n="common\.download_pdf"/, `${sourceName} PDF label is not localized`);
  assert.ok(
    footer.indexOf('id="btn-steps"') < footer.indexOf('id="btn-pdf"')
      && footer.indexOf('id="btn-pdf"') < footer.indexOf('id="btn-next"'),
    `${sourceName} PDF button is not between steps and next`,
  );
}

test('generator template places PDF only in the route footer', () => {
  assertPdfPlacement(read('scripts/generate-html.mjs'), 'generator');
});

test('every generated route places PDF only in the route footer', () => {
  for (const route of ROUTES) assertPdfPlacement(read(route), route);
});

test('footer PDF styling provides a mobile touch target', () => {
  const css = read('css/style.css');
  const rule = section(css, '.footer-pdf', /\.footer-pdf\s*\{([\s\S]*?)\}/);
  const footerRule = section(css, '.route-footer', /\.route-footer\s*\{([\s\S]*?)\}/);
  const routeCardsRule = section(css, '.route-cards', /\.route-cards\s*\{([\s\S]*?)\}/);
  assert.match(rule, /min-height:\s*(?:44|48)px/);
  assert.match(css, /\.footer-steps\s*\{[\s\S]*?min-width:\s*0/);
  assert.match(footerRule, /gap:\s*clamp\(8px, 3vw, var\(--spacing-md\)\)/);
  assert.match(routeCardsRule, /gap:\s*var\(--spacing-md\)/);
});
