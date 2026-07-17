# Visible PDF Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the route PDF download control from the hidden all-steps drawer into the permanently visible fixed footer on every generated route page.

**Architecture:** Keep `scripts/generate-html.mjs` as the sole source of route markup, reuse the existing `initPdfDownload()` behavior in `js/app.js`, and regenerate all route HTML after changing the template. Add a Node built-in regression test that checks both the template and generated pages so future rebuilds cannot silently move or duplicate the control.

**Tech Stack:** Static HTML, vanilla CSS, vanilla JavaScript, Node.js `node:test`, existing HTML generator.

## Global Constraints

- Target branch: `dev` after fast-forwarding it to the current `main`.
- The footer order is previous step, step counter, labeled PDF button, next step.
- The PDF control exists only in the footer and is removed from the drawer.
- The visible label continues to use `common.download_pdf`.
- The existing `/pdf/{routeId}-{language}.pdf` behavior remains unchanged.
- The PDF control remains visually secondary to the solid-orange next-step button.
- The PDF control has a minimum interactive height of 44 pixels.
- Do not change landing pages, route content, PDF generation, service-worker behavior, or language files.

---

## File Structure

- Create `tests/pdf-footer.test.mjs`: regression checks for the generator, generated route pages, and touch-target styling.
- Modify `scripts/generate-html.mjs`: move the existing `btn-pdf` markup from the drawer header to the route footer.
- Modify `css/style.css`: replace drawer-specific PDF styling with footer-specific styling and allow the footer counter to shrink safely on narrow screens.
- Regenerate `route/amalfi-house.html`, `route/atrani-house.html`, and `route/amalfi-awesome.html`: generated outputs from the updated template.
- Leave `js/app.js` unchanged: its existing `#btn-pdf` handler already supplies the correct route and language URL.

### Task 1: Move and verify the PDF control

**Files:**
- Create: `tests/pdf-footer.test.mjs`
- Modify: `scripts/generate-html.mjs:289-320`
- Modify: `css/style.css:1364-1508`
- Modify (generated): `route/amalfi-house.html`
- Modify (generated): `route/atrani-house.html`
- Modify (generated): `route/amalfi-awesome.html`

**Interfaces:**
- Consumes: `#btn-pdf`, `.steps[data-route]`, `currentLang`, and `common.download_pdf` from the existing application.
- Produces: one `.footer-pdf#btn-pdf` button inside each `.route-footer`; no PDF button inside `#steps-drawer`.

- [x] **Step 1: Write the failing regression test**

Create `tests/pdf-footer.test.mjs`:

```js
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
  assert.match(rule, /min-height:\s*(?:44|48)px/);
  assert.match(css, /\.footer-steps\s*\{[\s\S]*?min-width:\s*0/);
});
```

- [x] **Step 2: Run the test to verify it fails for the current hidden placement**

Run:

```bash
node --test tests/pdf-footer.test.mjs
```

Expected: FAIL in `generator template places PDF only in the route footer` because the current footer does not contain `class="footer-pdf" id="btn-pdf"`.

- [x] **Step 3: Move the generator markup**

In `scripts/generate-html.mjs`, remove the three-line `drawer-pdf` button from `.drawer-header`. Insert this button after `#btn-steps` and before `#btn-next`:

```html
    <button type="button" class="footer-pdf" id="btn-pdf" title="Download PDF" aria-label="Download PDF">
      <i data-lucide="download"></i> <span data-i18n="common.download_pdf">PDF</span>
    </button>
```

Do not change `js/app.js`; `initPdfDownload()` continues to bind to `#btn-pdf`.

- [x] **Step 4: Replace drawer-specific CSS with footer styling**

In `css/style.css`, change `.route-footer` to use a responsive gap:

```css
gap: clamp(8px, 3vw, var(--spacing-md));
```

Add `min-width: 0;` to `.footer-steps`, then replace the `.drawer-pdf` block with:

```css
/* Download action stays visible in the fixed route footer */
.footer-pdf {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  gap: 6px;
  min-height: 48px;
  padding: 0 12px;
  font-family: var(--font-body);
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--color-accent);
  background: var(--color-accent-light);
  border-radius: 14px;
  transition: background 0.15s ease, transform 0.1s ease;
}

.footer-pdf .lucide {
  width: 17px;
  height: 17px;
}

.footer-pdf:hover,
.footer-pdf:focus-visible {
  background: rgba(255, 89, 0, 0.18);
}

.footer-pdf:active {
  transform: scale(0.96);
}
```

- [x] **Step 5: Regenerate all route pages**

Run:

```bash
npm run html
```

Expected output:

```text
Generated route/amalfi-house.html (33 steps)
Generated route/atrani-house.html (21 steps)
Generated route/amalfi-awesome.html (14 steps)
```

- [x] **Step 6: Run the regression test and source checks**

Run:

```bash
node --test tests/pdf-footer.test.mjs
git diff --check
```

Expected: three tests pass, and `git diff --check` prints no errors.

- [x] **Step 7: Verify the mobile interaction in a browser**

Start the static site:

```bash
npm run dev
```

At a 320-by-700 viewport, open `/route/atrani-house.html` and verify:

- Previous, step counter, PDF, and next controls fit within the footer without overlap.
- PDF is visible before opening the all-steps drawer.
- Opening the drawer shows no duplicate PDF control.
- Switching to Russian and pressing PDF opens `/pdf/atrani-house-ru.pdf`.
- The next-step control remains the only solid-orange footer action.

- [x] **Step 8: Commit the focused implementation**

```bash
git add tests/pdf-footer.test.mjs scripts/generate-html.mjs css/style.css \
  route/amalfi-house.html route/atrani-house.html route/amalfi-awesome.html \
  docs/superpowers/plans/2026-07-17-visible-pdf-button.md
git commit -m "Make route PDF download visible"
```
