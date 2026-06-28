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

function ensureShimmerKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(SHIMMER_ID)) return;
  const style = document.createElement('style');
  style.id = SHIMMER_ID;
  // Sweep the 200%-wide gradient from right to left across the block.
  style.textContent = `@keyframes ${SHIMMER_ANIM}{0%{background-position:200% 0}100%{background-position:-200% 0}}`;
  document.head.appendChild(style);
}

// Base + highlight per canvas. Dark = the deepNavy gallery (browse grids); light
// = the beige home canvas.
const SHIMMER_COLORS = {
  light: { base: '#e3d9c8', hi: '#f2ece1' },
  dark: { base: 'rgba(245,235,220,0.06)', hi: 'rgba(245,235,220,0.16)' },
};

/**
 * Ref to attach to any web `View` to give it a sweeping shimmer fill. The
 * element's background + animation are applied imperatively on mount.
 */
export function useShimmer(dark = false) {
  const ref = useRef<View>(null);
  // Layout effect so the fill + sweep are present on first paint (no flash).
  useLayoutEffect(() => {
    ensureShimmerKeyframes();
    const el = ref.current as unknown as HTMLElement | null;
    if (!el) return;
    const { base, hi } = dark ? SHIMMER_COLORS.dark : SHIMMER_COLORS.light;
    el.style.backgroundImage = `linear-gradient(90deg, ${base} 0%, ${hi} 50%, ${base} 100%)`;
    el.style.backgroundSize = '200% 100%';
    el.style.backgroundColor = base;
    el.style.animation = `${SHIMMER_ANIM} 1.6s linear infinite`;
  }, [dark]);
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
