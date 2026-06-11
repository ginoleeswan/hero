import { useEffect } from 'react';
import { COLORS } from '../constants/colors';

/**
 * Paint the document canvas (html + body background) while a web screen is
 * mounted, then restore it on unmount.
 *
 * Native document scroll itself — switching the body off Expo's app-shell
 * `overflow: hidden` and resetting scroll position on navigation — is handled
 * once for every content route in `app/_layout.web.tsx`, so screens can't forget
 * to opt in. This hook only owns the part that legitimately differs per screen:
 * the canvas colour, so content past the `100dvh` fold reads continuous to the
 * very bottom (otherwise the layout's navy shell shows through under the iOS
 * Safari toolbar and along the edges). Pass the screen's dominant canvas colour —
 * beige for light screens, a dark tone for screens that end on a dark section.
 */
export function useWebDocumentScroll(background: string = COLORS.beige) {
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const { body } = document;
    const html = document.documentElement;
    const prevBodyBg = body.style.backgroundColor;
    const prevHtmlBg = html.style.backgroundColor;
    body.style.backgroundColor = background;
    html.style.backgroundColor = background;
    return () => {
      body.style.backgroundColor = prevBodyBg;
      html.style.backgroundColor = prevHtmlBg;
    };
  }, [background]);
}

// Backwards compatibility alias
export const useWebCanvas = useWebDocumentScroll;
