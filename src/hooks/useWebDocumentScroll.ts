import { useEffect } from 'react';
import { usePathname } from 'expo-router';
import { COLORS } from '../constants/colors';

/**
 * Switch a web screen to native document scrolling.
 *
 * Expo's `ScrollViewStyleReset` injects `body { overflow: hidden }` and pins the
 * app to `100dvh`, so every screen scrolls inside a nested RNW `<ScrollView>`.
 * On iOS Safari a nested scroller's box stops above the translucent toolbar, so
 * content clips there instead of bleeding under it — and the toolbar never
 * collapses (it only minimizes on *document* scroll). This hook restores native
 * document scroll while the screen is mounted, which is the only mode that lets
 * content flow edge-to-edge under the toolbar, exactly like a normal web page.
 *
 * It also paints the document background so content past the `100dvh` fold reads
 * continuous to the very bottom (otherwise the layout's navy `<body>` shows
 * through under the toolbar and along the edges). Pass the screen's dominant
 * canvas colour — beige for light screens, a dark tone for screens that end on a
 * dark section.
 *
 * Everything is restored on unmount, so screens still using nested ScrollViews
 * keep their existing behaviour. Pair this with rendering the screen's content in
 * plain `<View>`s (no outer `<ScrollView>`).
 */
export function useWebDocumentScroll(background: string = COLORS.beige) {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const { body } = document;
    const html = document.documentElement;
    const prevBodyBg = body.style.backgroundColor;
    const prevHtmlBg = html.style.backgroundColor;
    body.style.setProperty('overflow', 'visible', 'important');
    body.style.backgroundColor = background;
    html.style.backgroundColor = background;
    return () => {
      body.style.removeProperty('overflow');
      body.style.backgroundColor = prevBodyBg;
      html.style.backgroundColor = prevHtmlBg;
    };
  }, [background]);

  // With document scroll, the window keeps its scroll offset across navigation
  // (unlike a per-screen ScrollView that always mounts at the top). Reset to the
  // top on every route change so a new screen never opens part-scrolled.
  useEffect(() => {
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  }, [pathname]);
}
