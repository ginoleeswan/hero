// Favourite heart with a spring "pop" (web). When `favourited` flips true the
// icon scales up and springs back once — the app acknowledging the tap. The
// keyframe is injected once via the house <style> pattern (RNW can't express
// keyframes in style objects); the animation is replayed by remounting the
// icon on a bumped key. Under reduced motion the state still changes colour,
// it just doesn't bounce.
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { EASE_OVERSHOOT, prefersReducedMotion } from '../../lib/motion';

let injected = false;
function ensurePopStyle() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const el = document.createElement('style');
  el.textContent = `@keyframes fav-pop{0%{transform:scale(1)}40%{transform:scale(1.35)}100%{transform:scale(1)}}[data-fav-pop]{animation:fav-pop 350ms ${EASE_OVERSHOOT}}`;
  document.head.appendChild(el);
}

export function HeartPop({ favourited, size = 20 }: { favourited: boolean; size?: number }) {
  ensurePopStyle();
  // Bump a key each time we transition into the favourited state, so the icon
  // remounts and the CSS animation runs again. Skip the very first render and
  // un-favouriting (nothing to celebrate there).
  const [popKey, setPopKey] = useState(0);
  const prev = useRef(favourited);
  useEffect(() => {
    if (favourited && !prev.current && !prefersReducedMotion()) {
      setPopKey((k) => k + 1);
    }
    prev.current = favourited;
  }, [favourited]);

  return (
    // The View carries the CSS animation hook (RNW forwards dataSet → data-*)
    // and is remounted on popKey so the keyframe replays each favourite.
    <View key={popKey} {...(popKey > 0 ? ({ dataSet: { favPop: 'true' } } as object) : null)}>
      <Ionicons
        name={favourited ? 'heart' : 'heart-outline'}
        size={size}
        color={favourited ? COLORS.red : COLORS.beige}
      />
    </View>
  );
}
