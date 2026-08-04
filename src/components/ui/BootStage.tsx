// src/components/ui/BootStage.tsx — native boot choreography. Owns the cold
// start end-to-end: while `booting`, a full-screen deepNavy stage draws the
// logo (stroke traces in, ink fills, the mark breathes); the moment boot
// resolves the stage plays a single opening reveal — the logo solidifies and
// zooms through the viewer while the stage fades, and the app underneath
// settles up from 96.5% scale like a card being placed. The overlay unmounts
// after the reveal so nothing lingers over touch targets.
//
// AuthGate mounts the router as this component's child only once boot is done,
// so the reveal is what the user sees instead of an abrupt loader→app swap.
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  interpolate,
  withDelay,
  withTiming,
  withRepeat,
  withSequence,
  cancelAnimation,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { LOGO_MASK_PATH as LOGO_PATH } from '../../constants/logo';
import { COLORS } from '../../constants/colors';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// One draw cycle: stroke traces over the first 60%, ink fills over the last 40%.
const DRAW_CYCLE_MS = 2000;
// The opening reveal: a beat to let the fill land, then zoom-through + fade.
const REVEAL_DELAY_MS = 120;
const REVEAL_MS = 620;

export function BootStage({ booting, children }: { booting: boolean; children: ReactNode }) {
  // Overlay stays mounted through the reveal, then drops out entirely.
  const [revealDone, setRevealDone] = useState(!booting);
  const progress = useSharedValue(0); // looping draw cycle, 0→1
  const exit = useSharedValue(0); // opening reveal, 0→1

  useEffect(() => {
    progress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: DRAW_CYCLE_MS, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 0 }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(progress);
  }, [progress]);

  useEffect(() => {
    if (booting || revealDone) return;
    exit.value = withDelay(
      REVEAL_DELAY_MS,
      withTiming(1, { duration: REVEAL_MS, easing: Easing.bezier(0.22, 1, 0.36, 1) }, (done) => {
        if (done) runOnJS(setRevealDone)(true);
      }),
    );
    return () => cancelAnimation(exit);
  }, [booting, revealDone, exit]);

  const logoProps = useAnimatedProps(() => {
    const strokeProgress = Math.min(progress.value / 0.6, 1);
    const fillProgress = Math.max((progress.value - 0.6) / 0.4, 0);
    return {
      strokeDashoffset: 100 * (1 - strokeProgress),
      // The reveal solidifies the mark immediately, wherever the loop was.
      fillOpacity: Math.max(fillProgress, Math.min(exit.value * 4, 1)),
    };
  });

  const logoStyle = useAnimatedStyle(() => {
    // A slow breathe while drawing (the cycle's own easing keeps it gentle),
    // then the zoom-through as the stage opens.
    const breathe = 0.985 + 0.02 * Math.sin(progress.value * Math.PI);
    return {
      transform: [{ scale: breathe * interpolate(exit.value, [0, 1], [1, 1.45]) }],
    };
  });

  const stageStyle = useAnimatedStyle(() => ({
    opacity: interpolate(exit.value, [0, 0.35, 1], [1, 1, 0]),
  }));

  // The app settles from a touch larger + dimmer to at-rest as the stage opens
  // — a camera push-through rather than a hard cut.
  const appStyle = useAnimatedStyle(() => ({
    opacity: interpolate(exit.value, [0, 0.3, 1], [0, 1, 1]),
    transform: [{ scale: interpolate(exit.value, [0, 1], [0.965, 1]) }],
  }));

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.app, revealDone ? styles.appAtRest : appStyle]}>
        {children}
      </Animated.View>

      {!revealDone && (
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.stage, stageStyle]}
          pointerEvents={booting ? 'auto' : 'none'}
        >
          <Animated.View style={logoStyle}>
            <Svg width={120} height={120} viewBox="0 0 1024 1024">
              <AnimatedPath
                d={LOGO_PATH}
                // @ts-expect-error pathLength is a valid SVG attribute but missing from AnimatedPath types
                pathLength={100}
                stroke={COLORS.beige}
                strokeWidth={12}
                strokeDasharray={100}
                fill={COLORS.beige}
                animatedProps={logoProps}
              />
            </Svg>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.deepNavy },
  app: { flex: 1 },
  appAtRest: { opacity: 1 },
  stage: {
    backgroundColor: COLORS.deepNavy,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
