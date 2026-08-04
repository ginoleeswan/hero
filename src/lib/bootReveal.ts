// src/lib/bootReveal.ts — the one-shot latch that lets the boot stage open
// onto REAL content instead of a skeleton. The first meaningful screen (the
// Explore feed) signals when its first paint is ready; BootStage holds its
// reveal until then (with a cap, so a dead network can't hold the door shut).
// Module-level by design: the two sides must not know about each other's
// component trees, and the latch fires at most once per cold start.

type Cb = () => void;

let firstPaintDone = false;
let waiters: Cb[] = [];

/** Called by the first screen once it has real content on its first render. */
export function signalFirstPaint(): void {
  if (firstPaintDone) return;
  firstPaintDone = true;
  const cbs = waiters;
  waiters = [];
  cbs.forEach((cb) => cb());
}

/**
 * Run `cb` when the first paint is ready (immediately if it already is).
 * Returns an unsubscribe for the not-yet-fired case.
 */
export function onFirstPaint(cb: Cb): () => void {
  if (firstPaintDone) {
    cb();
    return () => {};
  }
  waiters.push(cb);
  return () => {
    waiters = waiters.filter((w) => w !== cb);
  };
}
