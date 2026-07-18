import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';
import { SITE_URL } from '../src/constants/site';

/**
 * Web-only HTML scaffold (server-rendered). Sets the document background to the
 * deep-navy app backdrop so the very first paint and any document-level
 * overscroll show dark — never the white/beige default behind the app.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        {/* Tints the iOS status-bar / browser chrome to match the deep-navy backdrop
            so the system UI blends with the page instead of flashing white. */}
        <meta name="theme-color" content="#0b1820" />
        {/* Keep Safari's own chrome dark through LOADING states too (the CSS
            color-scheme in the style below covers the rest; the meta form is
            parsed earliest). */}
        <meta name="color-scheme" content="dark" />
        {/* Preconnects: the grid's image CDNs + the API — shaves the DNS+TLS
            round-trips off the first hero-image and first query of a session
            (~100-300ms each on cellular). */}
        <link rel="preconnect" href="https://res.cloudinary.com" />
        <link rel="preconnect" href="https://comicvine.gamespot.com" />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        {process.env.EXPO_PUBLIC_SUPABASE_URL ? (
          <link
            rel="preconnect"
            href={process.env.EXPO_PUBLIC_SUPABASE_URL}
            crossOrigin="anonymous"
          />
        ) : null}

        {/* SEO + social sharing. The OG image is an absolute URL on the
            production domain — update it if you launch on a different host. */}
        <title>Mythique — Every universe. Every icon.</title>
        <meta
          name="description"
          content="Explore characters, teams, films and universes from across all fiction — Marvel, DC, Disney, anime, games and beyond — and pit any two against each other on Mythique."
        />
        <link rel="canonical" href={`${SITE_URL}/`} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Mythique" />
        <meta property="og:title" content="Mythique — Every universe. Every icon." />
        <meta
          property="og:description"
          content="Explore every fictional universe — characters, teams and films from Marvel to anime — and settle who'd win."
        />
        <meta property="og:url" content={`${SITE_URL}/`} />
        <meta property="og:image" content={`${SITE_URL}/og.png`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Mythique — Every universe. Every icon." />
        <meta
          name="twitter:description"
          content="Explore every fictional universe — characters, teams and films from Marvel to anime — and settle who'd win."
        />
        <meta name="twitter:image" content={`${SITE_URL}/og.png`} />
        {/* Site-level structured data: identifies Mythique as an Organization and
            declares the sitelinks search box (SearchAction → /search?q=). The
            deep content pages carry their own richer JSON-LD via /api/bot-page. */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        {/* Standalone web-app capability. When the site is added to the iOS Home
            Screen, `black-translucent` makes the status bar fully transparent and
            content flows behind it (true edge-to-edge, no grey scrim, no toolbar) —
            the immersive mode a plain Safari tab can't give us. */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Mythique" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: rootStyle }} />
        {/* Register the push-only service worker. No permission is requested
            here — that only happens when the user flips the Settings toggle. */}
        <script dangerouslySetInnerHTML={{ __html: swRegister }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

// Site-wide JSON-LD (WebSite + SearchAction + Organization). `<` is escaped so
// no field value can prematurely close the <script> tag.
const structuredData = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      name: 'Mythique',
      url: SITE_URL,
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'Organization',
      name: 'Mythique',
      url: SITE_URL,
      logo: `${SITE_URL}/icon-512.png`,
    },
  ],
}).replace(/</g, '\\u003c');

const rootStyle = `
/* Fill the FULL viewport — including behind the iOS status bar, home indicator
   and bottom toolbar. Expo's reset injects \`height: 100%\`, which on iOS Safari
   resolves to the chrome-excluded box, so the app gets boxed between the status
   bar and toolbar and the safe-area zones show the bare navy backdrop (the
   "bands"). 100lvh (LARGE viewport) is deliberate over 100dvh: dvh re-evaluates
   on every toolbar collapse/reveal, re-laying-out the entire app mid-gesture,
   and it stops ABOVE the collapsed toolbar; lvh is stable and bleeds the shell
   under the toolbar glass (constant-ink rule). !important beats Expo's
   same-selector reset; the plain 100% above is the fallback for old engines. */
html, body, #root {
  height: 100%;
  height: 100lvh !important;
}
/* The document's DEFAULT background. The iOS Safari status-bar inset and the
   frosted toolbar show whatever the body background is at that moment, so the
   default has to be the app's dark backdrop (deep-navy) — otherwise every
   loading/transition phase (font load, auth settle, the landing iframe's splash)
   shows a beige body through the bars before a route paints its own canvas.
   Content pages override this to beige at runtime via useWebCanvas, so the
   frosted toolbar still reads transparent over beige content there. */
html, body { background-color: #0b1820; overscroll-behavior-y: none; }
/* Safari renders its loading-state bars in the SYSTEM appearance (white in
   light mode) until the page declares otherwise — the white band under the
   toolbar during boot. Declaring a dark colour-scheme keeps the chrome dark
   through every loading phase. */
:root { color-scheme: dark; }
/* iOS Safari auto-zooms the page when a focused control's EFFECTIVE font-size
   is under 16px (it ignores maximum-scale=1 since 16). Enforce the floor from
   the very first paint — the runtime copy in _layout.web.tsx is the belt, this
   is the suspenders. */
input, textarea, select { font-size: max(16px, 1em) !important; }
/* Root view-transition pacing: a quick cross-fade between routes, not the
   browser's slower default. Named-element morphs (portrait → detail portrait,
   compare pick → arena) run their own animations; this only tunes the
   full-page fade underneath them. */
::view-transition-old(root), ::view-transition-new(root) { animation-duration: 220ms; }
/* Portrait morph (hero card → detail portrait): keep the portrait's rounded
   corners as it GROWS, then release them to 0 exactly as it lands in the
   full-bleed detail header — no square-off mid-morph, no snap at the end. The
   radius animates on the image-pair (which has no UA animation of its own), so
   it composes with the group's built-in size/position morph instead of
   replacing it; the header itself stays square (edge-to-edge at rest). */
@keyframes vt-hero-portrait-radius { from { border-radius: 22px; } to { border-radius: 0; } }
/* Return direction (detail → card): the portrait starts full-bleed (0) and
   GAINS radius as it shrinks home into the rounded card. goBack toggles the
   root class for the duration of the return transition. */
@keyframes vt-hero-portrait-radius-rev { from { border-radius: 0; } to { border-radius: 14px; } }
::view-transition-group(vt-hero-portrait) { overflow: clip; animation-duration: 250ms; }
::view-transition-image-pair(vt-hero-portrait) {
  overflow: clip;
  animation: vt-hero-portrait-radius 250ms cubic-bezier(0.2, 0, 0, 1) both;
}
:root.vt-returning ::view-transition-image-pair(vt-hero-portrait) {
  animation-name: vt-hero-portrait-radius-rev;
}
/* Character sheet entrance on morph arrivals: holds a beat while the portrait
   flies, then rises in as it lands (see character/[id].web.tsx). */
@keyframes char-sheet-in {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
/* Command-center pull-to-refresh: the ring spins while the refresh actually
   runs (see PullToRefreshIndicator). */
@keyframes ptr-spin { to { transform: rotate(360deg); } }
/* Let height: auto animate for user-driven expanders (read-more, filter
   panels). Chromium-only; elsewhere the expand is instant. */
:root { interpolate-size: allow-keywords; }
/* Honour the OS reduced-motion setting for every view transition. The
   JS-driven animations opt out individually via prefersReducedMotion(); this
   covers the CSS-only view-transition layer. */
@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(*), ::view-transition-new(*) { animation: none !important; }
}
/* Command-palette entrance (search overlay): fade the backdrop and rise+settle
   the panel on first mount via @starting-style — no mount-then-add-class dance.
   Chromium-only; elsewhere the overlay simply appears instantly. */
[data-anim="palette-backdrop"] { transition: opacity 160ms ease; }
[data-anim="palette-panel"] {
  transition: opacity 200ms cubic-bezier(0.16,1,0.3,1), transform 200ms cubic-bezier(0.16,1,0.3,1);
}
@starting-style {
  [data-anim="palette-backdrop"] { opacity: 0; }
  [data-anim="palette-panel"] { opacity: 0; transform: translateY(-8px) scale(0.98); }
}
@media (prefers-reduced-motion: reduce) {
  [data-anim="palette-backdrop"], [data-anim="palette-panel"] { transition: none; }
}
`;

// Registers /sw.js after load. Guarded for SSR/unsupported browsers. Registration
// alone shows nothing — the SW only wakes for a push, and permission is asked
// exclusively from the Settings toggle.
const swRegister = `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}
`;
