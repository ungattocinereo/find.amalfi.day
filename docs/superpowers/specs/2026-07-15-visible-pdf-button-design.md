# Visible PDF Button Design

## Goal

Make the downloadable route instructions immediately discoverable on every route page without weakening the existing next-step navigation.

## Approved Design

Move the existing PDF action from the hidden all-steps drawer into the fixed route footer. The footer order will be:

1. Previous-step button.
2. Current-step counter and progress bar, which continues to open the all-steps drawer.
3. A labeled `PDF` download button with a download icon.
4. Next-step button, which remains the primary orange action.

The PDF action will exist only in the footer. It will be removed from the drawer header rather than duplicated.

## Visual Treatment

The PDF button will use a compact rounded rectangular shape, an orange download icon, orange text, and the existing light-orange accent background. It must remain visually secondary to the solid-orange next-step button while being more explicit than an icon-only control.

The footer must remain usable at narrow mobile widths. The step counter may flex to use the remaining space, while the previous, PDF, and next controls retain touch-friendly dimensions.

## Behavior

The current download behavior remains unchanged:

- The selected route comes from the route page's `data-route` value.
- The selected language comes from the current interface language.
- Pressing the footer button opens `/pdf/{routeId}-{language}.pdf` in a new tab.
- The all-steps drawer continues to open when the user presses the central step counter.

No landing-page controls, PDF generation logic, service-worker behavior, or route content will change.

## Accessibility and Localization

- The button will remain a native `button` with an accessible `Download PDF` label.
- Visible `PDF` text will continue to use `common.download_pdf` from the existing translation files.
- The control must have the same focus-visible and pressed-state feedback as the other footer controls.
- The interactive height must remain at least 44 pixels on mobile.

## Source of Truth

The footer markup change must be made in `scripts/generate-html.mjs`, then all generated route HTML files must be rebuilt through the existing HTML generation command. Styling belongs in `css/style.css`; the existing handler in `js/app.js` should be reused without changing the URL format.

## Verification

Verification must cover:

- The PDF button is visible without opening the all-steps drawer on every generated route page.
- The drawer no longer contains a duplicate PDF button.
- English, Italian, German, French, Russian, and Chinese selections open the expected PDF URL.
- The footer remains contained and readable at narrow mobile widths.
- Previous, all-steps, PDF, and next actions still work independently.
- The generated route HTML is up to date after the build.
