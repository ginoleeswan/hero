import { useEffect, useLayoutEffect, useRef } from 'react';
import { Animated, View } from 'react-native';

/** Single shared animation value — call once per skeleton screen so all blocks pulse in sync. */
export function useSkeletonAnim() {
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        // Web-only component — there's no native animation driver in the browser,
        // so keep this on the JS driver to avoid the RCTAnimation warning.
        Animated.timing(opacity, { toValue: 1, duration: 750, useNativeDriver: false }),
        Animated.timing(opacity, { toValue: 0.5, duration: 750, useNativeDriver: false }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);
  return opacity;
}

// ── Shimmer ───────────────────────────────────────────────────────────────────
// A moving highlight sweep reads as "premium loading" where a flat opacity pulse
// reads cheap. Done via a once-injected @keyframes + a direct DOM `animation`
// (the dependable path on RNW — see PulseTicker; RNW's animationKeyframes style
// prop doesn't compile reliably here).

const SHIMMER_ID = 'mythique-shimmer-keyframes';
const SHIMMER_ANIM = 'mythique-shimmer';

const SHIMMER_DURATION_MS = 2600;

function ensureShimmerKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(SHIMMER_ID)) return;
  const style = document.createElement('style');
  style.id = SHIMMER_ID;
  // Sweep, then REST: the highlight glides across in the first ~55% and the rest
  // of the cycle holds off-screen. That "breathe" rhythm reads calm/premium where
  // a constant non-stop wipe reads cheap. Eased on the way in.
  style.textContent = `@keyframes ${SHIMMER_ANIM}{0%{background-position:130% 0}55%,100%{background-position:-130% 0}}`;
  document.head.appendChild(style);
}

// Base + highlight per canvas. Dark = the deepNavy gallery (browse grids); light
// = the beige home canvas. Beige-tinted highlight (not pure white) keeps it on
// brand; a wide, low-contrast band reads as a soft glow rather than a cheap bar.
const SHIMMER_COLORS = {
  light: { base: '#e7dfd1', hi: '#f6f1e8', edge: 'rgba(41,60,67,0.05)' },
  dark: {
    base: 'rgba(245,235,220,0.045)',
    hi: 'rgba(245,235,220,0.11)',
    edge: 'rgba(245,235,220,0.06)',
  },
};

/**
 * Ref to attach to any web `View` to give it a soft shimmer fill. The element's
 * background + animation are applied imperatively on mount.
 *
 * `phase` (0..1) offsets the animation start so a grid of blocks shimmers as a
 * desynchronised field — never every card flashing in unison (the cheap tell).
 */
export function useShimmer(dark = false, phase = 0) {
  const ref = useRef<View>(null);
  // Layout effect so the fill + sweep are present on first paint (no flash).
  useLayoutEffect(() => {
    ensureShimmerKeyframes();
    const el = ref.current as unknown as HTMLElement | null;
    if (!el) return;
    const { base, hi, edge } = dark ? SHIMMER_COLORS.dark : SHIMMER_COLORS.light;
    // Wide, gentle highlight band on a flat base — a soft glow that drifts across,
    // not a hard edge wiping over.
    el.style.backgroundColor = base;
    el.style.backgroundImage = `linear-gradient(100deg, ${base} 18%, ${hi} 50%, ${base} 82%)`;
    el.style.backgroundSize = '220% 100%';
    el.style.backgroundRepeat = 'no-repeat';
    // Hairline inset edge gives the block a touch of depth (reads as a "card").
    el.style.boxShadow = `inset 0 0 0 1px ${edge}`;
    el.style.willChange = 'background-position';
    el.style.animation = `${SHIMMER_ANIM} ${SHIMMER_DURATION_MS}ms ease-in-out infinite`;
    // Negative delay starts each block partway through the cycle, so a grid never
    // pulses together — at any instant different cards are mid-glow.
    el.style.animationDelay = `${-Math.round((phase % 1) * SHIMMER_DURATION_MS)}ms`;
  }, [dark, phase]);
  return ref;
}

interface SkeletonBlockProps {
  /** @deprecated kept for call-site compatibility — blocks now self-animate via shimmer. */
  opacity?: Animated.Value;
  width?: number | string;
  height: number;
  borderRadius?: number;
  /** Use on dark (navy) backgrounds — renders a darker-canvas shimmer instead. */
  dark?: boolean;
  style?: object;
}

/** A single shimmering rectangle. */
export function SkeletonBlock({
  width = '100%',
  height,
  borderRadius = 6,
  dark = false,
  style,
}: SkeletonBlockProps) {
  const ref = useShimmer(dark);
  return (
    <View
      ref={ref}
      style={[
        {
          width: width as number,
          height,
          borderRadius,
        },
        style,
      ]}
    />
  );
}
