import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

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
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        {/* Tints the iOS status-bar / browser chrome to match the deep-navy backdrop
            so the system UI blends with the page instead of flashing white. */}
        <meta name="theme-color" content="#0b1820" />
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
      </head>
      <body>{children}</body>
    </html>
  );
}

const rootStyle = `
/* Fill the FULL dynamic viewport — including behind the iOS status bar and home
   indicator. Expo's reset injects \`height: 100%\`, which on iOS Safari resolves to
   the chrome-excluded box, so the app gets boxed between the status bar and
   toolbar and the safe-area zones show the bare navy backdrop (the "bands").
   100dvh tracks the real viewport; !important is needed to beat Expo's
   same-selector reset, and the plain 100% above is the fallback for old engines. */
html, body, #root {
  height: 100%;
  height: 100dvh !important;
}
body { background-color: #0b1820; overscroll-behavior-y: none; }
`;
