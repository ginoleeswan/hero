import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { prefersReducedMotion } from '../../../lib/motion';
import { useInViewOnce } from '../../../hooks/useInViewOnce';

/** Eased (cubic ease-out) count-up mapping: progress 0→1 becomes 0→target. */
export function statDisplayValue(progress: number, target: number): number {
  const eased = 1 - (1 - progress) ** 3;
  return Math.round(target * eased);
}

const DURATION_MS = 750;

const reducedMotion = () => typeof window === 'undefined' || prefersReducedMotion();

// One Power Profile stat: big Flame number counts up while the bar sweeps to
// its fill, both on first scroll-into-view. Median tick marks the catalog
// midpoint. Reduced motion renders the final state immediately.
export function PowerStatCell({
  value,
  label,
  color,
  median,
  delay = 0,
}: {
  value: number | null;
  label: string;
  color: string;
  median?: number;
  /** Stagger (ms) so a grid of cells cascades instead of firing at once. */
  delay?: number;
}) {
  const ref = useRef<View>(null);
  // Fires once when the cell scrolls into view (immediate under reduced motion /
  // SSR / no IntersectionObserver). threshold 0.4 + no bottom margin preserves
  // the cell's original trigger point.
  const play = useInViewOnce(ref, { threshold: 0.4, rootMargin: '0px' });
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
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const progress = Math.min(Math.max(now - start, 0) / DURATION_MS, 1);
      setDisplay(statDisplayValue(progress, target));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [play, target, delay]);

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
                transition: `width 750ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
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
