// Scroll-entrance wrapper (web): children rise ~14px and fade in the first
// time the section enters the viewport, so the long chaptered page reveals
// itself with pacing instead of existing all at once. One IntersectionObserver
// per section; fires once, then disconnects. Under prefers-reduced-motion the
// content renders visible immediately with no transition.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

type Phase = 'hidden' | 'shown' | 'landed' | 'instant';

export function Reveal({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const ref = useRef<View>(null);
  const [phase, setPhase] = useState<Phase>(() =>
    typeof window === 'undefined' ||
    typeof IntersectionObserver === 'undefined' ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      ? 'instant'
      : 'hidden',
  );

  useEffect(() => {
    if (phase !== 'hidden') return;
    // RNW renders View as a DOM element at runtime.
    const el = ref.current as unknown as HTMLElement | null;
    if (!el) {
      // Shouldn't happen, but never leave content invisible.
      const t = setTimeout(() => setPhase('instant'), 0);
      return () => clearTimeout(t);
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPhase('shown');
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [phase]);

  // Once the rise finishes, drop the opacity/transform/transition styles
  // entirely: a settled translateY(0) still holds a composited layer, and iOS
  // Safari clips composited layers to the layout viewport while the bottom
  // toolbar collapses — content in the under-toolbar band went unpainted.
  useEffect(() => {
    if (phase !== 'shown') return;
    const t = setTimeout(() => setPhase('landed'), 650); // transition is 600ms
    return () => clearTimeout(t);
  }, [phase]);

  const settled = phase === 'landed' || phase === 'instant';
  const visible = phase !== 'hidden';
  return (
    <View
      ref={ref}
      style={
        [
          settled
            ? null
            : ({
                opacity: visible ? 1 : 0,
                transform: [{ translateY: visible ? 0 : 14 }],
                transition:
                  'opacity 600ms cubic-bezier(0.16, 1, 0.3, 1), transform 600ms cubic-bezier(0.16, 1, 0.3, 1)',
              } as object),
          style,
        ] as object
      }
    >
      {children}
    </View>
  );
}
