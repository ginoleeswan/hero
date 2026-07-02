import { SURFACE } from '../constants/colors';
import { useChromeColor } from '../contexts/WebChromeContext';
import { useWebCanvas } from './useWebCanvas';

interface ScreenChrome {
  /**
   * Colour at the very top of the screen — the iOS status-bar tint (in a
   * Home-Screen/standalone install), the status-bar cover, and the web TopBar all
   * lock to it. Should match the page's own top section (the dark band or hero
   * stage). Omit it and it falls back to `canvas`.
   */
  top?: string;
  /**
   * The screen's dominant CONTENT colour — `SURFACE.paper` for light screens,
   * `SURFACE.ink` for full-dark ones. Each screen paints this on its own
   * container (sized to the full scroll height), NOT on the document body.
   *
   * Note: this no longer touches `<body>`. In a plain iOS Safari tab both the top
   * status bar and the bottom toolbar are tinted from the `<body>` background, so
   * letting each page paint the body its own colour made that system chrome flip
   * per page (beige on content pages, navy on Explore — the bug this hook now
   * prevents). The body is pinned to a single deep-navy instead; see below.
   */
  canvas: string;
}

/**
 * Single source of truth for a web screen's top edge and canvas. Web-only —
 * both underlying hooks no-op without a `document`.
 *
 * The document `<body>`/`<html>` background is pinned to the app's deep-navy on
 * EVERY route (`SURFACE.ink`), so the iOS Safari system chrome — status bar and
 * bottom toolbar, both tinted from `<body>` in a tab — reads a consistent dark on
 * every page instead of mirroring the page's content colour. Light screens still
 * look beige because they paint their own beige container that fills the full
 * scroll height; the navy body only shows through the system chrome and on
 * overscroll. (In a Home-Screen/standalone install, `useChromeColor` additionally
 * drives the real status-bar cover + theme-color to `top`.)
 */
export function useScreenChrome({ top, canvas }: ScreenChrome) {
  useWebCanvas(SURFACE.ink);
  useChromeColor(top ?? canvas);
}
