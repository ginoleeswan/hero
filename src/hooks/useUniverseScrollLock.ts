import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * Hold the document still while a full-bleed WebGL screen is on top.
 *
 * The universe scene fills the viewport and claims drag and pinch for itself,
 * so the page underneath must not scroll or rubber-band while it is up.
 *
 * Keyed on FOCUS, not on mount. Doing this in the scene's own effect meant the
 * revert only ran when that component unmounted — which happens when you go
 * back, but not when you navigate forward: expo-router keeps the previous
 * screen mounted in the stack, so `overflow: hidden` outlived the page and
 * every screen opened from the universe was frozen. Blur is the honest signal
 * that this screen has stopped being the one in front, and it fires for both.
 *
 * The app scrolls the DOCUMENT by design (see the web document-scroll rule),
 * which is exactly why leaving this behind breaks everything downstream.
 */
export function useUniverseScrollLock(): void {
  useFocusEffect(
    useCallback(() => {
      if (typeof document === 'undefined') return;
      const doc = document.documentElement.style;
      const body = document.body.style;
      // Captured rather than assumed: another screen may legitimately have set
      // these, and this one has no business deciding what they should be after.
      const prev = {
        docMargin: doc.margin,
        docHeight: doc.height,
        bodyMargin: body.margin,
        bodyHeight: body.height,
        bodyOverflow: body.overflow,
      };
      // The UA's default body margin alone shifts the canvas off-centre.
      doc.margin = '0';
      doc.height = '100%';
      body.margin = '0';
      body.height = '100%';
      body.overflow = 'hidden';
      return () => {
        doc.margin = prev.docMargin;
        doc.height = prev.docHeight;
        body.margin = prev.bodyMargin;
        body.height = prev.bodyHeight;
        body.overflow = prev.bodyOverflow;
      };
    }, []),
  );
}
