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

// ── Skeleton glow ─────────────────────────────────────────────────────────────
// A calm, UNISON "breath" — the whole field gently rises and settles in
// brightness as one. No moving highlight band (a sweep draws the eye and reads
// cheap); cohesion is the point. Done via a once-injected @keyframes + a direct
// DOM `animation` (the dependable path on RNW — see PulseTicker).

const BREATH_ID = 'mythique-skeleton-breath';
const BREATH_ANIM = 'mythique-skel-breath';
const BREATH_DURATION_MS = 2400;

function ensureBreathKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(BREATH_ID)) return;
  const style = document.createElement('style');
  style.id = BREATH_ID;
  // Gentle opacity swell — present, recede, present. Low floor so it never blinks.
  style.textContent = `@keyframes ${BREATH_ANIM}{0%,100%{opacity:.62}50%{opacity:1}}`;
  document.head.appendChild(style);
}

// Per canvas. Dark = the deepNavy gallery (browse grids); light = the beige home
// canvas. A warm-white film on the dark canvas reads as an elevated surface, not
// a grey patch.
const GLOW_COLORS = {
  light: { base: '#e7dfd1', edge: 'rgba(41,60,67,0.05)' },
  dark: { base: 'rgba(245,235,220,0.07)', edge: 'rgba(245,235,220,0.06)' },
};

/**
 * Ref to attach to any web `View` to give it the surface-tinted skeleton fill and
 * the unison breath. The background + animation are applied imperatively on mount;
 * every block mounts in the same commit, so the whole field breathes together.
 */
export function useSkeletonGlow(dark = false) {
  const ref = useRef<View>(null);
  // Layout effect so the fill is present on first paint (no flash).
  useLayoutEffect(() => {
    ensureBreathKeyframes();
    const el = ref.current as unknown as HTMLElement | null;
    if (!el) return;
    const { base, edge } = dark ? GLOW_COLORS.dark : GLOW_COLORS.light;
    el.style.backgroundColor = base;
    // Hairline inset edge gives the block a touch of depth (reads as a "card").
    el.style.boxShadow = `inset 0 0 0 1px ${edge}`;
    el.style.willChange = 'opacity';
    el.style.animation = `${BREATH_ANIM} ${BREATH_DURATION_MS}ms ease-in-out infinite`;
  }, [dark]);
  return ref;
}

interface SkeletonBlockProps {
  /** @deprecated kept for call-site compatibility — blocks now self-animate. */
  opacity?: Animated.Value;
  width?: number | string;
  height: number;
  borderRadius?: number;
  /** Use on dark (navy) backgrounds — renders the darker-canvas surface fill. */
  dark?: boolean;
  style?: object;
}

/** A single breathing skeleton block. */
export function SkeletonBlock({
  width = '100%',
  height,
  borderRadius = 6,
  dark = false,
  style,
}: SkeletonBlockProps) {
  const ref = useSkeletonGlow(dark);
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
