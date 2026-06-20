import { useChromeColor } from '../contexts/WebChromeContext';
import { useWebCanvas } from './useWebCanvas';

interface ScreenChrome {
  /**
   * Colour at the very top of the screen — the iOS status-bar tint, the
   * status-bar cover, and the web TopBar all lock to it. Should match the page's
   * own top section (the dark band or hero stage). Omit it and it falls back to
   * `canvas`, so the top can never silently drift to the deep-navy default —
   * the cause of the status-bar vs. bottom-toolbar colour mismatch.
   */
  top?: string;
  /**
   * The document canvas: the content body and the iOS Safari bottom-toolbar
   * zone (what the frosted toolbar blurs, and what shows past the fold and on
   * overscroll). Pass the screen's dominant body colour — `SURFACE.paper` for
   * light screens, `SURFACE.ink` for full-dark ones.
   */
  canvas: string;
}

/**
 * Single source of truth for a web screen's top edge and canvas. Wraps the two
 * previously independent systems (`useChromeColor` for the top chrome,
 * `useWebCanvas` for the document background) so a page declares both together
 * and they can't drift apart. Web-only — both underlying hooks no-op without a
 * `document`.
 */
export function useScreenChrome({ top, canvas }: ScreenChrome) {
  useWebCanvas(canvas);
  useChromeColor(top ?? canvas);
}
