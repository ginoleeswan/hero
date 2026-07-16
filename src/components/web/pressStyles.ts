// Shared "tactile" recipe for web Pressables: scale up a touch on hover,
// compress on press, springing back with a slight overshoot. Applied uniformly
// across cards, chips and buttons so the whole surface feels physical instead
// of only certain corners. Transform-only (compositor-cheap) and layout-safe —
// the scale never reflows neighbours.
import { EASE_OVERSHOOT, MOTION } from '../../lib/motion';

/**
 * Put on a Pressable's *base* style so its transform animates in and out. Pair
 * with pressTransform() in the style callback. Add your own extra transition
 * segments (box-shadow, opacity) after this if the element needs them.
 */
export const PRESS_TRANSITION = `transform ${MOTION.fast}ms ${EASE_OVERSHOOT}`;

/**
 * The interactive transform for a Pressable's `({ hovered, pressed })` style
 * callback. Returns null at rest so it composes cleanly into a style array.
 * Press wins over hover (a pressed control is always also hovered).
 */
export function pressTransform(
  state: { hovered?: boolean; pressed: boolean },
  { hoverScale = 1.02, pressScale = 0.96 }: { hoverScale?: number; pressScale?: number } = {},
): object | null {
  if (state.pressed) return { transform: [{ scale: pressScale }] } as object;
  if (state.hovered) return { transform: [{ scale: hoverScale }] } as object;
  return null;
}
