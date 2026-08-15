// src/components/event/CountUp.tsx
// A number that counts to its value the first time it is scrolled into view.
//
// It exists for one figure: the readership multiple in an event's "Who it moved"
// band. "Beast was read 527x his own median during D23 2024" is the most
// striking thing Mythique can state, and a number that ARRIVES at 527 says
// "this went up" in a way a number that was always 527 does not.
//
// Why not Reanimated: Reanimated animates STYLE off the UI thread and cannot
// drive the text content of a <Text> without a worklet-side formatter
// (react-native-redash's ReText, which this project does not have). The value
// here is a short one-shot on a handful of rows, so a plain rAF loop on the JS
// thread is both simpler and honest about what it is.
import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { Text } from '../ui/Text';

/**
 * True once the element has been at least a quarter visible.
 *
 * On web this is a real IntersectionObserver — react-native-web forwards a View
 * ref to its DOM node, so the observer can watch it directly. That matters
 * because the band sits well below the fold: animating on mount would run the
 * whole thing before anyone had scrolled to it, which is the same as not
 * animating at all.
 *
 * Everywhere else (and anywhere the observer is missing) it returns true
 * immediately, so the animation runs on mount rather than never.
 */
function useInView<T>(): { ref: React.MutableRefObject<T | null>; inView: boolean } {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(Platform.OS !== 'web');

  /* eslint-disable react-hooks/set-state-in-effect --
     Synchronising with a platform API, which is what an effect is for. Whether
     an IntersectionObserver exists, and whether react-native-web actually gave
     this ref a DOM node, are both unknowable during render — they are properties
     of the host, not of props. Both branches are the "observer is unavailable,
     so treat it as visible" fallback, and getting it wrong means the number
     never counts at all. */
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const node = ref.current as unknown as Element | null;
    if (!node) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  return { ref, inView };
}

/** Ease-out cubic. The number should sprint and settle, not arrive at a constant
 *  rate — a linear count reads as a loading spinner made of digits. */
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export function CountUp({
  value,
  suffix = '',
  decimals,
  delay = 0,
  duration = 900,
  style,
}: {
  value: number;
  suffix?: string;
  /** Defaults to matching the source value, so 51.1 counts in tenths and 527
   *  counts in whole numbers — a spike rendered as "527.0x" is a different
   *  claim from the one the data makes. */
  decimals?: number;
  delay?: number;
  duration?: number;
  style?: object;
}) {
  const dp = decimals ?? (Number.isInteger(value) ? 0 : 1);
  const reduced = useReducedMotion();
  const { ref, inView } = useInView<View>();
  // Starts AT the value when motion is reduced, so the figure is never wrong —
  // only never animated.
  const [shown, setShown] = useState(reduced ? value : 0);

  /* eslint-disable react-hooks/set-state-in-effect --
     The displayed figure IS external state: it is driven by requestAnimationFrame
     and by the reduced-motion setting, neither of which can be read during
     render. This branch is the one that must land on the final value when the
     animation will not run — without it a reduced-motion reader sees 0. */
  useEffect(() => {
    if (reduced || !inView) {
      setShown(value);
      return;
    }
    let raf = 0;
    let start = 0;
    const step = (now: number) => {
      if (!start) start = now;
      const t = Math.min(1, (now - start - delay) / duration);
      if (t < 0) {
        raf = requestAnimationFrame(step);
        return;
      }
      setShown(value * easeOut(t));
      if (t < 1) raf = requestAnimationFrame(step);
      // Land exactly on the value rather than on the easing's last sample.
      else setShown(value);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, inView, reduced, delay, duration]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <View ref={ref}>
      <Text style={style}>
        {shown.toFixed(dp)}
        {suffix}
      </Text>
    </View>
  );
}
