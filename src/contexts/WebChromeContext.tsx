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
import { COLORS } from '../constants/colors';

/**
 * Web top-chrome colour.
 *
 * In a Safari tab the iOS system status bar can't be reliably re-tinted on
 * scroll (dynamic theme-color updates don't repaint it), so rather than let the
 * status bar and the top bar drift apart we keep them locked together: the top
 * bar, the status-bar cover, and the theme-color meta all match a single colour
 * the page declares — the tint at the very top of that screen. The result is a
 * top edge that's always seamless (status bar → cover → bar read as one piece),
 * consistent across every page.
 */

interface WebChromeValue {
  /** The colour the chrome matches — the tint at the very top of the screen. */
  color: string;
  /** True when `color` is light enough to need dark icons/text on top of it. */
  isLight: boolean;
  /** Declare this screen's top colour. */
  setColor: (color: string) => void;
}

const DEFAULT_COLOR: string = COLORS.deepNavy;

const WebChromeContext = createContext<WebChromeValue>({
  color: DEFAULT_COLOR,
  isLight: false,
  setColor: () => {},
});

// Perceived luminance (sRGB weights). Above the threshold the surface is light
// enough that chrome sitting on it must switch to dark icons/text for contrast.
function isLightColor(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  return 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b > 140;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const c = hex.replace('#', '');
  if (c.length < 6) return null;
  return {
    r: parseInt(c.slice(0, 2), 16),
    g: parseInt(c.slice(2, 4), 16),
    b: parseInt(c.slice(4, 6), 16),
  };
}

// iOS Safari only honours *hex* theme-color values for the status-bar tint — it
// silently ignores rgb(), so the animated frames must be hex too.
function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => n.toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

// Duration of the chrome colour cross-fade. Shared by the status-bar tint
// animation here and the CSS transition on the cover, so the whole top edge
// changes colour as one synchronised motion when a new page declares a new tint.
const CHROME_FADE_MS = 300;

export function WebChromeProvider({ children }: { children: ReactNode }) {
  const [color, setColorState] = useState(DEFAULT_COLOR);

  const setColor = useCallback(
    (next: string) => setColorState((prev) => (prev === next ? prev : next)),
    []
  );

  const isLight = isLightColor(color);

  // Drive the iOS Safari status-bar tint. Expo's single web output ignores
  // app/+html.tsx, so we own the theme-color meta at runtime. iOS has no CSS
  // transition for theme-color, so we interpolate it ourselves over
  // CHROME_FADE_MS (hex only — rgb() is ignored) to match the cover's CSS fade,
  // tracking the current value in a ref so a new fade starts wherever the last
  // one left off.
  const themeRgbRef = useRef<{ r: number; g: number; b: number } | null>(null);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    const to = hexToRgb(color);
    const from = themeRgbRef.current;
    // First paint (no prior value) snaps; thereafter we always have a from→to.
    if (!to || !from) {
      themeRgbRef.current = to;
      meta.content = color;
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / CHROME_FADE_MS);
      // easeInOutQuad — gentle in and out, no abrupt edges.
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      const r = Math.round(from.r + (to.r - from.r) * e);
      const g = Math.round(from.g + (to.g - from.g) * e);
      const b = Math.round(from.b + (to.b - from.b) * e);
      themeRgbRef.current = { r, g, b };
      meta!.content = rgbToHex(r, g, b);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [color]);

  const value = useMemo(() => ({ color, isLight, setColor }), [color, isLight, setColor]);

  return <WebChromeContext.Provider value={value}>{children}</WebChromeContext.Provider>;
}

export function useWebChrome() {
  return useContext(WebChromeContext);
}

/**
 * Opaque strip over exactly the iOS status-bar inset, painted the current chrome
 * colour so it's identical to the system status bar above it (same value the
 * theme-color meta uses) — the two fuse into one seamless cap. env() → 0 on
 * Android/desktop, so it collapses to nothing there.
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
    // Force a GPU compositing layer so the fixed strip stays pinned on iOS
    // (body overflow:visible otherwise lets fixed elements drift on scroll).
    transform: 'translateZ(0)',
    willChange: 'transform',
    transition: `background-color ${CHROME_FADE_MS}ms ease`,
  } as object,
});

/**
 * Declare the current screen's top colour for as long as it's mounted — the tint
 * at the very top, under the status bar. The top bar, status-bar cover and iOS
 * status-bar tint all lock to it. Defaults to the app's deep-navy hero backdrop.
 */
export function useChromeColor(color: string = DEFAULT_COLOR) {
  const { setColor } = useWebChrome();
  useEffect(() => {
    setColor(color);
    return () => setColor(DEFAULT_COLOR);
  }, [color, setColor]);
}
