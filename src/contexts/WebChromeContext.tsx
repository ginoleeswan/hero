import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { View, StyleSheet } from 'react-native';
import { usePathname } from 'expo-router';
import { COLORS } from '../constants/colors';

/**
 * Adaptive web top-chrome.
 *
 * Every mobile-web page is shaped the same way: a dark hero header at the very
 * top, then a light (beige) content canvas below. A single static chrome can
 * only ever match one of those, so the status bar / top bar always clashes with
 * the other. This context makes the chrome adaptive instead: a page declares its
 * two colours (the header tint at the top, the content tint once scrolled) and
 * drops a <ChromeSentinel /> at the bottom edge of its dark header. As that
 * sentinel scrolls under the bar we flip `mode`, and everything that paints the
 * top — the floating top bar, its icon colours, the status-bar cover, and the
 * iOS `theme-color` meta that tints the system status bar — derives from the
 * single resolved `color`, so the whole top edge stays seamless at every scroll
 * position on every page.
 */

type ChromeMode = 'header' | 'content';

interface WebChromeValue {
  /** The colour the chrome is currently matching (header tint or content tint). */
  color: string;
  /** True when `color` is light enough to need dark icons/text on top of it. */
  isLight: boolean;
  /** Declare this screen's header tint (top) and content tint (scrolled). */
  setColors: (header: string, content: string) => void;
  /** Sentinels report whether the dark header still covers the top bar. */
  setHeaderCovering: (covering: boolean) => void;
}

const DEFAULTS: { header: string; content: string } = {
  header: COLORS.deepNavy,
  content: COLORS.beige,
};

const WebChromeContext = createContext<WebChromeValue>({
  color: DEFAULTS.header,
  isLight: false,
  setColors: () => {},
  setHeaderCovering: () => {},
});

// Perceived luminance (sRGB weights). Above the threshold the surface is light
// enough that chrome sitting on it must switch to dark icons/text for contrast.
function isLightColor(hex: string): boolean {
  const c = hex.replace('#', '');
  if (c.length < 6) return false;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 140;
}

export function WebChromeProvider({ children }: { children: ReactNode }) {
  const [colors, setColorsState] = useState(DEFAULTS);
  // Default to header mode: a fresh route always opens at the top, over its hero.
  const [mode, setMode] = useState<ChromeMode>('header');

  const setColors = useCallback((header: string, content: string) => {
    setColorsState((prev) =>
      prev.header === header && prev.content === content ? prev : { header, content }
    );
  }, []);

  const setHeaderCovering = useCallback(
    (covering: boolean) => setMode(covering ? 'header' : 'content'),
    []
  );

  // Every route opens at the top, over its header — reset to header mode on
  // navigation so a page left in content mode doesn't bleed into the next one
  // before its sentinel re-measures.
  const pathname = usePathname();
  useEffect(() => setMode('header'), [pathname]);

  const color = mode === 'header' ? colors.header : colors.content;
  const isLight = isLightColor(color);

  // Drive the iOS Safari status-bar tint. Expo's single web output ignores
  // app/+html.tsx, so we own the theme-color meta at runtime; pointing it at the
  // current chrome colour makes the system status bar track the page as it
  // scrolls — dark over the hero, light over the content — with no seam.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = color;
  }, [color]);

  const value = useMemo(
    () => ({ color, isLight, setColors, setHeaderCovering }),
    [color, isLight, setColors, setHeaderCovering]
  );

  return <WebChromeContext.Provider value={value}>{children}</WebChromeContext.Provider>;
}

export function useWebChrome() {
  return useContext(WebChromeContext);
}

/**
 * Opaque strip over exactly the iOS status-bar inset, painted the current chrome
 * colour so it's identical to the system status bar above it (same value the
 * theme-color meta uses) — the two fuse into one seamless cap. Tracks the colour
 * as the page scrolls, so the cap goes dark over the hero and light over the
 * content. env() → 0 on Android/desktop, so it collapses to nothing there.
 */
export function AdaptiveStatusBarCover() {
  const { color } = useWebChrome();
  return <View pointerEvents="none" style={[coverStyles.cover, { backgroundColor: color }]} />;
}

const coverStyles = StyleSheet.create({
  cover: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: 'env(safe-area-inset-top)',
    zIndex: 9999,
    transition: 'background-color 240ms ease',
  } as object,
});

/**
 * Declare the current screen's chrome colours for as long as it's mounted.
 * `header` is the tint at the very top (under the status bar), `content` is the
 * canvas once scrolled past the header. Pages with no dark header pass the same
 * colour for both. Defaults match the app's deep-navy hero → beige content shape.
 */
export function useChromeColors(
  header: string = DEFAULTS.header,
  content: string = DEFAULTS.content
) {
  const { setColors } = useWebChrome();
  useEffect(() => {
    setColors(header, content);
    return () => setColors(DEFAULTS.header, DEFAULTS.content);
  }, [header, content, setColors]);
}

// Top bar height (kept in sync with TOPBAR_HEIGHT in TopBar.tsx). Declared here
// too so the sentinel doesn't have to import TopBar — that would be a cycle,
// since TopBar consumes this context.
const TOPBAR_HEIGHT = 64;

/**
 * Invisible 1px marker a page renders at the bottom edge of its dark header.
 * While it sits below the top bar the chrome is in header (dark) mode; once it
 * scrolls up under the bar we flip to content (light) mode. Using the real
 * element position — rather than a guessed scroll threshold — keeps the switch
 * exactly aligned to where the hero actually ends, on every page.
 */
export function ChromeSentinel() {
  const { setHeaderCovering } = useWebChrome();
  const ref = useRef<View>(null);

  useEffect(() => {
    const el = ref.current as unknown as HTMLElement | null;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    // Push the observation boundary down past the bar + status-bar inset, so the
    // sentinel reads as "uncovered" the instant it slides beneath the bar.
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;top:0;height:env(safe-area-inset-top);visibility:hidden';
    document.body.appendChild(probe);
    const inset = probe.getBoundingClientRect().height;
    probe.remove();

    const observer = new IntersectionObserver(
      ([entry]) => setHeaderCovering(entry.isIntersecting),
      { rootMargin: `-${TOPBAR_HEIGHT + inset}px 0px 0px 0px`, threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [setHeaderCovering]);

  return <View ref={ref} style={SENTINEL_STYLE} pointerEvents="none" />;
}

const SENTINEL_STYLE = { width: '100%', height: 1 } as const;
