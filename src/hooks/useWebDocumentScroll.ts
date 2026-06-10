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
// The document-scroll mode is a global on `<body>`, but during navigation expo
// router keeps the outgoing screen mounted while the incoming one mounts — so two
// screens run this hook at once. Restoring each instance's captured "previous"
// value on unmount then races: the outgoing screen's cleanup fires *after* the
// incoming screen's setup and reverts `overflow` back to the reset's `hidden`,
// stranding every later screen (its content — and the fixed header — pinned to a
// broken scroll box). A shared count fixes the order: only the *last* doc-scroll
// screen to unmount tears the mode down, back to the layout's known baseline.
const BASELINE_BG = '#0b1820'; // deep navy — what app/_layout.web.tsx paints
let activeCount = 0;

export function useWebDocumentScroll(background: string = COLORS.beige) {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const { body } = document;
    const html = document.documentElement;
    activeCount += 1;
    body.style.setProperty('overflow', 'visible', 'important');
    body.style.backgroundColor = background;
    html.style.backgroundColor = background;
    return () => {
      activeCount -= 1;
      if (activeCount === 0) {
        body.style.removeProperty('overflow');
        body.style.backgroundColor = BASELINE_BG;
        html.style.backgroundColor = BASELINE_BG;
      }
    };
  }, [background]);

  // With document scroll, the window keeps its scroll offset across navigation
  // (unlike a per-screen ScrollView that always mounts at the top). Reset to the
  // top on every route change so a new screen never opens part-scrolled.
  useEffect(() => {
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  }, [pathname]);
}
