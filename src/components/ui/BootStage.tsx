// src/components/ui/BootStage.tsx — native boot choreography. Owns the cold
// start end-to-end, in three acts on a deep-ink stage:
//
//   1. Trace   — the logo strokes itself in once (never restarts: a redrawing
//                loop reads as a glitch whenever boot outlasts one cycle),
//                then the ink fills as the stroke completes.
//   2. Hold    — the filled mark breathes almost imperceptibly over a warm
//                ember halo that swells with it. Calm, not busy: this is the
//                state users sit in on a slow network, so it must feel settled.
//   3. Reveal  — the moment boot resolves: an accent ring ripples outward,
//                the mark blooms toward the viewer, and the stage dissolves
//                while the app underneath settles up from 96.5% — a single
//                camera push-through instead of a hard loader→app cut.
//
// Honors Reduce Motion: the reveal collapses to a plain crossfade and the
// breathing/ripple never run. AuthGate mounts the router as this component's
// child only once boot is done, so the reveal is the handoff itself. The
// overlay unmounts after the reveal so nothing lingers over touch targets.
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  interpolate,
  Extrapolation,
  withDelay,
  withTiming,
  withRepeat,
  cancelAnimation,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { LOGO_MASK_PATH as LOGO_PATH } from '../../constants/logo';
import { COLORS } from '../../constants/colors';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// The Svg is RENDERED at 2× its resting display size and scaled DOWN by
// transform. react-native-svg rasterizes at layout size, so scaling a 120px
// raster up through the 1.5× bloom reads soft/low-res — rendering at 240 and
// never exceeding scale 1 keeps the mark crisp through the whole choreography.
const SVG_SIZE = 240;
const LOGO_DISPLAY = 120;
const BASE_SCALE = LOGO_DISPLAY / SVG_SIZE;

const TRACE_MS = 1500; // one stroke pass; fill blooms over its tail
const BREATHE_MS = 2600; // full in-out breath — slow enough to read as calm
const REVEAL_MS = 640;
const REVEAL_DELAY_MS = 90; // let the fill land before opening
const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);

export function BootStage({ booting, children }: { booting: boolean; children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const [revealDone, setRevealDone] = useState(!booting);
  const trace = useSharedValue(0); // act 1: 0→1 once
  const breathe = useSharedValue(0); // act 2: 0↔1 forever
  const exit = useSharedValue(0); // act 3: 0→1 once

  useEffect(() => {
    if (reduceMotion) {
      trace.value = 1; // settle on the filled mark immediately
      return;
    }
    trace.value = withTiming(1, { duration: TRACE_MS, easing: Easing.inOut(Easing.cubic) });
    breathe.value = withDelay(
      TRACE_MS,
      withRepeat(
        withTiming(1, { duration: BREATHE_MS, easing: Easing.inOut(Easing.sin) }, undefined),
        -1,
        true,
      ),
    );
    return () => {
      cancelAnimation(trace);
      cancelAnimation(breathe);
    };
  }, [trace, breathe, reduceMotion]);

  useEffect(() => {
    if (booting || revealDone) return;
    cancelAnimation(breathe);
    exit.value = withDelay(
      reduceMotion ? 0 : REVEAL_DELAY_MS,
      withTiming(1, { duration: reduceMotion ? 260 : REVEAL_MS, easing: EASE_OUT }, (done) => {
        if (done) runOnJS(setRevealDone)(true);
      }),
    );
    return () => cancelAnimation(exit);
  }, [booting, revealDone, exit, breathe, reduceMotion]);

  const logoProps = useAnimatedProps(() => ({
    // Stroke traces over the first 70% of the act; ink blooms over its tail so
    // the fill arrives while the last stroke segment is still landing.
    strokeDashoffset: 100 * (1 - Math.min(trace.value / 0.7, 1)),
    fillOpacity: Math.max(
      interpolate(trace.value, [0.55, 1], [0, 1], Extrapolation.CLAMP),
      // The reveal completes the mark instantly, wherever the trace was.
      Math.min(exit.value * 5, 1),
    ),
  }));

  const logoStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale:
          BASE_SCALE * // downscale from the 2× raster — never magnify
          (1 + breathe.value * 0.012) * // barely-there breath
          interpolate(exit.value, [0, 1], [1, 1.5]), // bloom through the viewer
      },
    ],
  }));

  // Warm ember halo behind the mark — swells with the breath, flares briefly
  // as the reveal opens, then fades with the stage.
  const haloStyle = useAnimatedStyle(() => ({
    opacity:
      interpolate(trace.value, [0.5, 1], [0, 0.5], Extrapolation.CLAMP) *
      (1 + breathe.value * 0.35) *
      interpolate(exit.value, [0, 0.25, 1], [1, 1.4, 0]),
    transform: [{ scale: (1 + breathe.value * 0.06) * (1 + exit.value * 0.5) }],
  }));

  // Accent ring that ripples outward the instant the app opens — the one
  // deliberate flourish of the reveal.
  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(exit.value, [0, 0.08, 0.7], [0, 0.45, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(exit.value, [0, 1], [0.55, 2.4]) }],
  }));

  const stageStyle = useAnimatedStyle(() => ({
    opacity: interpolate(exit.value, [0, 0.4, 1], [1, 1, 0]),
  }));

  // The app settles from a touch smaller + dimmer to at-rest as the stage
  // dissolves — the push-through that makes the open feel physical.
  const appStyle = useAnimatedStyle(() => ({
    opacity: interpolate(exit.value, [0, 0.35, 1], [0, 1, 1]),
    transform: [{ scale: interpolate(exit.value, [0, 1], [0.965, 1]) }],
  }));
  const appReduced = useAnimatedStyle(() => ({
    opacity: interpolate(exit.value, [0, 1], [0, 1]),
  }));

  return (
    <View style={styles.root}>
      <Animated.View
        style={[styles.app, revealDone ? styles.appAtRest : reduceMotion ? appReduced : appStyle]}
      >
        {children}
      </Animated.View>

      {!revealDone && (
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.stage, stageStyle]}
          pointerEvents={booting ? 'auto' : 'none'}
        >
          {/* Soft top-light on the ink so the stage has depth, not flatness. */}
          <LinearGradient
            colors={['#122430', COLORS.deepNavy, COLORS.deepNavy]}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          <View style={styles.centre} pointerEvents="none">
            {/* Ember halo — three stacked translucent discs approximate a soft
                radial glow without any blur cost. */}
            <Animated.View style={[styles.haloWrap, haloStyle]}>
              <View style={[styles.halo, styles.haloOuter]} />
              <View style={[styles.halo, styles.haloMid]} />
              <View style={[styles.halo, styles.haloCore]} />
            </Animated.View>

            {/* Reveal ripple */}
            <Animated.View style={[styles.ring, ringStyle]} />

            <Animated.View style={logoStyle}>
              <Svg width={SVG_SIZE} height={SVG_SIZE} viewBox="0 0 1024 1024">
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
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const HALO = 260;
const RING = 150;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.deepNavy },
  app: { flex: 1 },
  appAtRest: { opacity: 1 },
  stage: {
    backgroundColor: COLORS.deepNavy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centre: { alignItems: 'center', justifyContent: 'center' },
  haloWrap: {
    position: 'absolute',
    width: HALO,
    height: HALO,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: { position: 'absolute', borderRadius: HALO },
  haloOuter: { width: HALO, height: HALO, backgroundColor: 'rgba(231,115,51,0.05)' },
  haloMid: { width: HALO * 0.72, height: HALO * 0.72, backgroundColor: 'rgba(231,115,51,0.06)' },
  haloCore: { width: HALO * 0.46, height: HALO * 0.46, backgroundColor: 'rgba(231,115,51,0.08)' },
  ring: {
    position: 'absolute',
    width: RING,
    height: RING,
    borderRadius: RING,
    borderWidth: 1.5,
    borderColor: COLORS.orange,
  },
});
