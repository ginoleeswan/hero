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
  // Travel the over-sized gradient across the block. Eased (see animation) so the
  // highlight glides and softly settles at each end rather than hard-looping.
  style.textContent = `@keyframes ${SHIMMER_ANIM}{0%{background-position:150% 0}100%{background-position:-150% 0}}`;
  document.head.appendChild(style);
}

// Base + highlight per canvas. Dark = the deepNavy gallery (browse grids); light
// = the beige home canvas. Beige-tinted highlight (not pure white) keeps it on
// brand; low contrast reads premium where a harsh white sweep reads cheap.
const SHIMMER_COLORS = {
  light: { base: '#e6ddce', hi: '#f4efe6', edge: 'rgba(41,60,67,0.05)' },
  dark: {
    base: 'rgba(245,235,220,0.05)',
    hi: 'rgba(245,235,220,0.13)',
    edge: 'rgba(245,235,220,0.06)',
  },
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
    const { base, hi, edge } = dark ? SHIMMER_COLORS.dark : SHIMMER_COLORS.light;
    // Narrow, soft highlight band (concentrated ~mid, feathered edges) on a flat
    // base — a diagonal glide rather than a hard full-width wipe.
    el.style.backgroundColor = base;
    el.style.backgroundImage = `linear-gradient(100deg, ${base} 40%, ${hi} 50%, ${base} 60%)`;
    el.style.backgroundSize = '250% 100%';
    el.style.backgroundRepeat = 'no-repeat';
    // Hairline inset edge gives the block a touch of depth (reads as a "card").
    el.style.boxShadow = `inset 0 0 0 1px ${edge}`;
    el.style.willChange = 'background-position';
    el.style.animation = `${SHIMMER_ANIM} 2s cubic-bezier(0.4, 0, 0.2, 1) infinite`;
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
