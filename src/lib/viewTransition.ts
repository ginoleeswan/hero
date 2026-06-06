import { flushSync } from 'react-dom';

type ViewTransitionDoc = Document & {
  startViewTransition?: (cb: () => unknown) => unknown;
};

/**
 * Run a navigation (or any DOM-affecting update) inside the browser's View
 * Transition API so shared `view-transition-name` elements morph between the
 * old and new screens. The update is committed synchronously with `flushSync`
 * inside the callback — using `requestAnimationFrame` here would deadlock,
 * because the browser suspends rendering (and therefore rAF) until the callback
 * resolves. Falls back to a plain update where the API is unavailable
 * (Firefox/Safari) or off the web.
 */
export function withViewTransition(run: () => void): void {
  const doc = typeof document !== 'undefined' ? (document as ViewTransitionDoc) : undefined;
  if (doc?.startViewTransition) {
    doc.startViewTransition(() => flushSync(() => run()));
  } else {
    run();
  }
}
