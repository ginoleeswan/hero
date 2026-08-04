// src/components/ui/BootStage.tsx — native boot choreography, designed as ONE
// continuous piece of motion from the OS splash to the home feed:
//
//   1. Still  — the first frame is PIXEL-CONTINUOUS with the native splash:
//               the same flat navy (#293C43) and the same filled beige mask at
//               the same 200px width, centered. No trace-in, no redraw — the
//               logo the user is already looking at simply keeps existing.
//               (Earlier versions stroked the logo in from nothing, which
//               ERASED the splash's mark and re-drew it — a visible restart
//               that no amount of easing could make seamless.)
//   2. Alive  — over the first second the still frame wakes up: a deepening
//               gradient gives the stage dimension, a warm ember halo breathes
//               in behind the mark, and the mark itself starts a slow breath.
//               Calm by intent: this is the state a slow network sits in.
//   3. Open   — gated on the home feed's FIRST PAINT (src/lib/bootReveal.ts,
//               capped at 1.4s past boot so a dead network can't hold the
//               door): an accent ring ripples out, the mark blooms toward the
//               viewer and is fully gone by 55% of the reveal, and the stage
//               dissolves over the fully-opaque app, which settles up from
//               96.5% scale. The feed's row cascade begins as the stage
//               clears, so the open hands straight into content arriving.
//
// Honors Reduce Motion: no breathing, no ripple — a plain crossfade handoff.
// AuthGate mounts the router as this component's child only once boot is done.
// The overlay unmounts after the reveal so nothing lingers over touch targets.
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
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
import { onFirstPaint } from '../../lib/bootReveal';

// Match the native splash exactly (app.config.ts: image 200px wide on
// #293c43). The mask spans ~83.3% of its 1024 viewBox, so a 240px Svg shows
// the mark at 200px. Rendered at 2× and scaled DOWN by transform:
// react-native-svg rasterizes at layout size, and a downscaled raster stays
// crisp through the bloom where an upscaled one went soft.
const SVG_DISPLAY = 240;
const SVG_SIZE = 480;
const BASE_SCALE = SVG_DISPLAY / SVG_SIZE;
const SPLASH_NAVY = '#293C43'; // must equal app.config.ts splash backgroundColor

const ALIVE_DELAY_MS = 250; // hold the perfect splash match for a beat
const ALIVE_MS = 900; // the still frame waking up
const BREATHE_MS = 2600; // full in-out breath
const REVEAL_MS = 620;
const REVEAL_CAP_MS = 1400; // max wait for the feed's first paint after boot
const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);

export function BootStage({ booting, children }: { booting: boolean; children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const [revealDone, setRevealDone] = useState(!booting);
  const alive = useSharedValue(0); // act 2: 0→1 once
  const breathe = useSharedValue(0); // act 2: 0↔1 forever
  const exit = useSharedValue(0); // act 3: 0→1 once

  useEffect(() => {
    if (reduceMotion) return;
    alive.value = withDelay(
      ALIVE_DELAY_MS,
      withTiming(1, { duration: ALIVE_MS, easing: Easing.inOut(Easing.ease) }),
    );
    breathe.value = withDelay(
      ALIVE_DELAY_MS + ALIVE_MS / 2,
      withRepeat(
        withTiming(1, { duration: BREATHE_MS, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
    return () => {
      cancelAnimation(alive);
      cancelAnimation(breathe);
    };
  }, [alive, breathe, reduceMotion]);

  // The open: wait for the home feed's first paint (or the cap), then run one
  // exit timing. Gating on content is what makes the reveal land on a real
  // screen instead of a skeleton that immediately re-transitions.
  useEffect(() => {
    if (booting || revealDone) return;
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      cancelAnimation(breathe);
      exit.value = withTiming(
        1,
        { duration: reduceMotion ? 260 : REVEAL_MS, easing: EASE_OUT },
        (done) => {
          if (done) runOnJS(setRevealDone)(true);
        },
      );
    };
    const cap = setTimeout(start, REVEAL_CAP_MS);
    const unsub = onFirstPaint(start);
    return () => {
      clearTimeout(cap);
      unsub();
      cancelAnimation(exit);
    };
  }, [booting, revealDone, exit, breathe, reduceMotion]);

  const logoStyle = useAnimatedStyle(() => ({
    // Gone by 55% of the reveal — the mark must never float over readable
    // app content while the stage dissolves behind it.
    opacity: interpolate(exit.value, [0, 0.2, 0.55], [1, 1, 0], Extrapolation.CLAMP),
    transform: [
      {
        scale:
          BASE_SCALE * // downscale from the 2× raster — never magnify
          (1 + breathe.value * 0.012) * // barely-there breath
          interpolate(exit.value, [0, 1], [1, 1.3]), // bloom toward the viewer
      },
    ],
  }));

  // Depth gradient + ember halo fade in AFTER the splash-matched still frame,
  // so the handoff moment stays flat-navy identical.
  const depthStyle = useAnimatedStyle(() => ({
    opacity: alive.value * interpolate(exit.value, [0, 1], [1, 0.6]),
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity:
      alive.value *
      (0.4 + breathe.value * 0.18) *
      interpolate(exit.value, [0, 0.25, 1], [1, 1.35, 0]),
    transform: [{ scale: (1 + breathe.value * 0.05) * (1 + exit.value * 0.4) }],
  }));

  // Accent ring that ripples outward the instant the app opens — the one
  // deliberate flourish of the reveal.
  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(exit.value, [0, 0.08, 0.7], [0, 0.4, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(exit.value, [0, 1], [0.55, 2.2]) }],
  }));

  const stageStyle = useAnimatedStyle(() => ({
    opacity: interpolate(exit.value, [0, 0.25, 1], [1, 1, 0]),
  }));

  // The app underneath is ALWAYS fully opaque — only the stage fades. Fading
  // both at once averaged two translucent layers into a muddy grey wash. The
  // app performs only a scale settle (96.5% → 100%) for the push-through feel.
  const appStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(exit.value, [0, 1], [0.965, 1]) }],
  }));

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.app, revealDone || reduceMotion ? styles.appAtRest : appStyle]}>
        {children}
      </Animated.View>

      {!revealDone && (
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.stage, stageStyle]}
          pointerEvents={booting ? 'auto' : 'none'}
        >
          {/* Soft top-light + deep base, faded in during the alive act so the
              first frame stays identical to the flat native splash. */}
          <Animated.View style={[StyleSheet.absoluteFill, depthStyle]} pointerEvents="none">
            <LinearGradient
              colors={['#2e444c', SPLASH_NAVY, '#1d2e35']}
              locations={[0, 0.42, 1]}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          <View style={styles.centre} pointerEvents="none">
            {/* Ember halo — stacked translucent ellipses approximate a soft
                glow behind the wide mask with no blur cost. */}
            <Animated.View style={[styles.haloWrap, haloStyle]}>
              <View style={[styles.halo, styles.haloOuter]} />
              <View style={[styles.halo, styles.haloMid]} />
              <View style={[styles.halo, styles.haloCore]} />
            </Animated.View>

            {/* Reveal ripple */}
            <Animated.View style={[styles.ring, ringStyle]} />

            <Animated.View style={logoStyle}>
              <Svg width={SVG_SIZE} height={SVG_SIZE} viewBox="0 0 1024 1024">
                <Path d={LOGO_PATH} fill={COLORS.beige} />
              </Svg>
            </Animated.View>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const HALO_W = 340;
const HALO_H = 190;
const RING = 170;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.deepNavy },
  app: { flex: 1 },
  appAtRest: { opacity: 1 },
  stage: {
    backgroundColor: SPLASH_NAVY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centre: { alignItems: 'center', justifyContent: 'center' },
  haloWrap: {
    position: 'absolute',
    width: HALO_W,
    height: HALO_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: { position: 'absolute', borderRadius: 999 },
  haloOuter: { width: HALO_W, height: HALO_H, backgroundColor: 'rgba(231,115,51,0.05)' },
  haloMid: {
    width: HALO_W * 0.72,
    height: HALO_H * 0.72,
    backgroundColor: 'rgba(231,115,51,0.06)',
  },
  haloCore: {
    width: HALO_W * 0.46,
    height: HALO_H * 0.46,
    backgroundColor: 'rgba(231,115,51,0.09)',
  },
  ring: {
    position: 'absolute',
    width: RING,
    height: RING,
    borderRadius: RING,
    borderWidth: 1.5,
    borderColor: COLORS.orange,
  },
});
