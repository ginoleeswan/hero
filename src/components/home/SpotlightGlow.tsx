// src/components/home/SpotlightGlow.tsx — the deck's publisher-tinted ambience.
//
// Web's stage orb (`pss.orbA`) is a CSS radial-gradient whose backgroundColor
// transitions over 800ms — gradients can't animate, so the trick there is
// animating the flat, pre-blurred colour underneath one. Native has no
// backdrop blur to lean on, so this has to actually BE a radial: react-native
// DailyGame's own `GLOW` constant fell back to a flat `backgroundColor` disc
// on native, and its comment records the failed alternative — three stacked
// translucent discs — as "visible hard edges where they met". A flat disc
// here would be the same failure. `react-native-svg`'s `RadialGradient` (also
// used by BootStage's ember) is a real gradient on every platform, so the
// bloom fades to nothing instead of stopping at an edge.
import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

const AnimatedStop = Animated.createAnimatedComponent(Stop);

// Matches web's `transition: 'background-color 800ms ease'` on the orb.
const GLOW_MS = 800;

export function SpotlightGlow({ color, size }: { color: string; size: number }) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(1);
  // [from, to] — mutated in place so useAnimatedProps always reads the pair
  // the in-flight tween is actually easing between, not a stale render-time
  // closure over `color`.
  const stops = useRef<[string, string]>([color, color]);

  useEffect(() => {
    if (stops.current[1] === color) return;
    stops.current = [stops.current[1], color];
    if (reduced) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withTiming(1, { duration: GLOW_MS });
  }, [color, reduced, progress]);

  const animatedProps = useAnimatedProps(() => ({
    stopColor: interpolateColor(progress.value, [0, 1], stops.current),
  }));

  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="spotlight-glow" cx="50%" cy="50%" r="50%">
          <AnimatedStop offset="0" animatedProps={animatedProps} stopOpacity={1} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={size} height={size} fill="url(#spotlight-glow)" />
    </Svg>
  );
}
