import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

/** Eased (cubic ease-out) count-up mapping: progress 0→1 becomes 0→target. */
export function statDisplayValue(progress: number, target: number): number {
  const eased = 1 - (1 - progress) ** 3;
  return Math.round(target * eased);
}

const DURATION_MS = 750;

const reducedMotion = () =>
  typeof window === 'undefined' ||
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/** Fires once when the ref'd element scrolls into view; immediate under
 *  reduced motion / SSR / no IntersectionObserver. */
function usePlayOnce(): [React.RefObject<View | null>, boolean] {
  const ref = useRef<View>(null);
  const [play, setPlay] = useState(
    () =>
      typeof window === 'undefined' ||
      typeof IntersectionObserver === 'undefined' ||
      reducedMotion(),
  );
  useEffect(() => {
    if (play) return;
    const el = ref.current as unknown as HTMLElement | null;
    if (!el) {
      setPlay(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPlay(true);
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [play]);
  return [ref, play];
}

// One Power Profile stat: big Flame number counts up while the bar sweeps to
// its fill, both on first scroll-into-view. Median tick marks the catalog
// midpoint. Reduced motion renders the final state immediately.
export function PowerStatCell({
  value,
  label,
  color,
  median,
}: {
  value: number | null;
  label: string;
  color: string;
  median?: number;
}) {
  const [ref, play] = usePlayOnce();
  const target = value ?? 0;
  const fill = Math.min(target, 100);
  const [display, setDisplay] = useState(0);
  const animatedRef = useRef(false);

  useEffect(() => {
    if (!play || animatedRef.current) return;
    animatedRef.current = true;
    if (reducedMotion()) {
      // Skip the count-up animation; jump straight to the final value.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplay(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / DURATION_MS, 1);
      setDisplay(statDisplayValue(progress, target));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [play, target]);

  return (
    <View ref={ref} style={styles.cell}>
      <Text style={[styles.val, { color }] as object}>{value === null ? '—' : display}</Text>
      <View style={styles.track}>
        <View
          style={
            [
              styles.fill,
              {
                width: play ? `${fill}%` : '0%',
                // Tiny values still read as a deliberate fill.
                minWidth: play && fill > 0 ? 5 : 0,
                backgroundColor: color,
                transition: 'width 750ms cubic-bezier(0.16, 1, 0.3, 1)',
              },
            ] as object
          }
        />
        {median != null ? (
          <View style={[styles.medianTick, { left: `${median}%` }] as object} />
        ) : null}
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cell: { flex: 1, alignItems: 'center', gap: 8 },
  // Non-clamped Flame display.
  val: { fontFamily: 'Flame-Regular', fontSize: 30, lineHeight: 32 } as object,
  track: {
    width: '88%',
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(41,60,67,0.10)',
    overflow: 'hidden',
  } as object,
  fill: { height: '100%', borderRadius: 3 } as object,
  medianTick: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(41,60,67,0.35)',
  } as object,
  // Matches the screen's previous bandLabel exactly.
  label: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#A2A19B',
  },
});
