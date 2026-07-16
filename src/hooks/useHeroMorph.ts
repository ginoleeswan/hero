// Drives the card → character-detail portrait morph from the departing side.
// A hero card calls `run(navigate)` from its onPress: the card's portrait is
// tagged with the shared view-transition-name synchronously (so it lands in the
// "old" snapshot), the navigation runs inside a view transition, and the detail
// page tags its own portrait on arrival — the card art visually becomes the
// detail portrait. The name is dropped once the transition finishes so it can't
// hijack the next navigation (the list screen stays mounted under a push).
//
// Safe on native and in unsupported browsers: withViewTransition falls back to a
// plain navigation there, and `morphName` simply never activates.
import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { VT_PORTRAIT, markMorphDeparture, withViewTransition } from '../lib/viewTransition';

export function useHeroMorph(id: string, enabled = true) {
  const [morphing, setMorphing] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const run = useCallback(
    (navigate: () => void) => {
      if (!enabled) {
        navigate();
        return;
      }
      markMorphDeparture(id);
      // Commit the name into the DOM before the transition captures the old
      // snapshot.
      flushSync(() => setMorphing(true));
      const transition = withViewTransition(navigate);
      const clear = () => {
        if (alive.current) setMorphing(false);
      };
      // Drop the name once the morph settles; fall back to a timer if the API
      // gave us no transition (fallback path) or never resolves.
      if (transition?.finished) {
        transition.finished.then(clear, clear);
      } else {
        clear();
      }
    },
    [id, enabled],
  );

  return { morphName: morphing ? VT_PORTRAIT : undefined, run };
}
