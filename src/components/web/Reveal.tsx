// Scroll-entrance wrapper (web): children rise ~14px and fade in the first
// time the section enters the viewport, so the long chaptered page reveals
// itself with pacing instead of existing all at once. Viewport detection lives
// in useInViewOnce; this component owns the visual rise + the post-landing
// teardown. Under prefers-reduced-motion (or SSR) the hook reports "seen"
// immediately, so content renders settled with no transition.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useInViewOnce } from '../../hooks/useInViewOnce';
import { EASE_OUT_EXPO, MOTION } from '../../lib/motion';

export function Reveal({
  children,
  style,
  delay = 0,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Stagger offset (ms) — for cascading a row/grid of Reveals. */
  delay?: number;
}) {
  const ref = useRef<View>(null);
  const visible = useInViewOnce(ref);
  // If the very first render is already "seen" (reduced motion / SSR / no IO)
  // there is nothing to animate, so start landed — settled, no transition.
  const [landed, setLanded] = useState(visible);

  // Once the rise finishes, drop the opacity/transform/transition styles
  // entirely: a settled translateY(0) still holds a composited layer, and iOS
  // Safari clips composited layers to the layout viewport while the bottom
  // toolbar collapses — content in the under-toolbar band went unpainted.
  useEffect(() => {
    if (!visible || landed) return;
    const t = setTimeout(() => setLanded(true), MOTION.entrance + delay + 50);
    return () => clearTimeout(t);
  }, [visible, landed, delay]);

  return (
    <View
      ref={ref}
      style={
        [
          landed
            ? null
            : ({
                opacity: visible ? 1 : 0,
                transform: [{ translateY: visible ? 0 : 14 }],
                transition: `opacity ${MOTION.entrance}ms ${EASE_OUT_EXPO}, transform ${MOTION.entrance}ms ${EASE_OUT_EXPO}`,
                transitionDelay: delay ? `${delay}ms` : undefined,
              } as object),
          style,
        ] as object
      }
    >
      {children}
    </View>
  );
}
