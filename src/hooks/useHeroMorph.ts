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
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import { Image } from 'expo-image';
import {
  VT_PORTRAIT,
  type MorphArt,
  markMorphDeparture,
  withViewTransition,
  subscribeMorphReturn,
  getMorphReturnId,
  claimMorphReturn,
} from '../lib/viewTransition';
import { heroImageSource } from '../constants/heroImages';

export function useHeroMorph(art: MorphArt, enabled = true) {
  const [morphing, setMorphing] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Return morph (detail → card): when the detail page navigates back it marks
  // this hero as the return target; the matching card tags itself with the
  // shared name so the detail portrait shrinks back into it. The claim ensures
  // exactly one card tags even if the hero appears in several rows (duplicate
  // names would abort the transition). The store pings subscribers before the
  // back-navigation is flushed, so the tag is committed into the transition's
  // "new" snapshot.
  // A lazy useState rather than the useRef + null-check dance: the token is a
  // stable per-instance identity, which is exactly what a lazy initialiser
  // gives, and it removes a ref READ during render — the thing that made this
  // fragile in the first place, since a ref is not meant to be part of what
  // render depends on.
  const [claimToken] = useState(() => Symbol('morph-return'));
  const returnId = useSyncExternalStore(subscribeMorphReturn, getMorphReturnId, () => null);
  const returning =
    enabled && returnId != null && returnId === art.id && claimMorphReturn(art.id, claimToken);

  const run = useCallback(
    (navigate: () => void) => {
      if (!enabled) {
        navigate();
        return;
      }
      // Stash the art so the detail page can paint this portrait immediately —
      // otherwise a cache-miss detail page is all skeleton and the morph has no
      // target in the new snapshot.
      markMorphDeparture(art);
      // Warm the full-res detail image now, while the morph plays and stats
      // load, so the settled portrait upgrades from the card's cached grid image
      // without a visible gap on a first (cold) visit.
      const fullUri = heroImageSource(art.id, art.image_url, art.portrait_url).uri;
      if (fullUri) Image.prefetch(fullUri, { cachePolicy: 'memory-disk' }).catch(() => {});
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
    // art is a fresh object each render; depend on its FIELDS, not its
    // identity, or this callback would be rebuilt on every render and the
    // memoised card below it with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [art.id, art.name, art.image_url, art.portrait_url, enabled],
  );

  return { morphName: morphing || returning ? VT_PORTRAIT : undefined, run };
}
