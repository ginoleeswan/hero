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
//   3. Open   — gated on the home feed's FIRST PAINT (useSignalFirstPaint,
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
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
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
import { DUR, EASE_REVEAL } from '../../lib/nativeMotion';

// ── Frame-1 geometry, measured rather than assumed ──────────────────────────
//
// The first frame must be PIXEL-CONTINUOUS with the native splash, so both
// sides of the handoff are derived from real measurements of the two assets:
//
//   assets/splash.png   720x279 canvas, opaque ink 695x260 (aspect 2.673).
//                       The ink spans 96.53% of the canvas width, and its
//                       centre sits 6 canvas units ABOVE the canvas centre.
//                       app.config.ts renders it at imageWidth 200 →
//                       ink = 200 x 0.9653 = 193.06pt, lifted 1.67pt.
//
//   LOGO_MASK_PATH      1024 viewBox, true curve bounds (cubic extremes, not
//                       the control hull) x 100.75..923.35, y 359.60..667.31.
//                       Ink 822.60 x 307.71 — aspect 2.673, identical to the
//                       PNG, confirming one artwork. It spans 80.33% of the
//                       viewBox, and its centre sits 1.5 units BELOW centre.
//
// The old constants claimed 83.3% and "200px", both wrong; the errors happened
// to cancel to within 0.26pt of width, which is why nobody caught them. The
// vertical never cancelled: the mark landed ~2pt low at handoff, a 6-physical-
// pixel jump on a 3x screen, and it was visible as a small settle.
const SPLASH_INK_W = 193.06; // what the OS splash actually shows, in points
const INK_SPAN = 822.6 / 1024; // ink width as a fraction of the viewBox
const SVG_DISPLAY = SPLASH_INK_W / INK_SPAN; // ≈240.3, not 240
const SVG_SIZE = 480; // rendered at 2x, scaled DOWN by transform:
// react-native-svg rasterizes at layout size, and a downscaled raster stays
// crisp through the bloom where an upscaled one went soft.
const BASE_SCALE = SVG_DISPLAY / SVG_SIZE;
// Align the two inks' centres: the path's is 1.5/1024 of the display box low,
// the PNG's is 1.67pt high. Both corrections push the same way.
const FRAME1_DY = -((1.5 / 1024) * SVG_DISPLAY + 1.67);
const SPLASH_NAVY = '#293C43'; // must equal app.config.ts splash backgroundColor

// ── The resting composition ─────────────────────────────────────────────────
//
// The splash does NOT rest where it starts. It starts as an exact copy of the
// OS splash — centred, full size — because that is the only way the handoff can
// be invisible; then, during the alive act, the mark settles into the real
// composition: smaller, lifted above centre, with the wordmark arriving in the
// footer beneath it.
//
// This is deliberately motion rather than a different first frame. Changing
// where the mark STARTS would mean changing assets/splash.png and app.config.ts
// — a native change that cannot ship over the air, and one that would pop at
// handoff unless the PNG were re-cut to the new position. Animating from the
// shared frame gets the composition the design wants while keeping frame 1
// honest.
const REST_SCALE = 0.66; // mark settles to two-thirds
const REST_CENTRE = 0.36; // ...centred at 36% of screen height, not 50%
const WORDMARK_SIZE = 30;
const WORDMARK_BOTTOM = 44; // above the safe-area inset

const ALIVE_DELAY_MS = 250; // hold the perfect splash match for a beat
const ALIVE_MS = 900; // the still frame waking up
const BREATHE_MS = 2600; // full in-out breath
const REVEAL_CAP_MS = 1400; // max wait for the feed's first paint after boot

// The first meaningful screen calls this once it has real content laid out, so
// the reveal opens onto content rather than a skeleton. A context, not a
// module-level singleton: the signal is scoped to this BootStage instance, it
// cannot leak between mounts (or across tests), and it needs no hand-written
// subscribe/emit — React already does that.
const SignalFirstPaintContext = createContext<() => void>(() => {});

/** Call when the first screen's real content has been laid out. */
export function useSignalFirstPaint(): () => void {
  return useContext(SignalFirstPaintContext);
}

export function BootStage({
  booting,
  fontsReady = true,
  children,
}: {
  booting: boolean;
  /** Gates the wordmark so it never paints in a fallback face. */
  fontsReady?: boolean;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  // How far the mark rises from the OS splash's centre to its resting place.
  const restRise = (0.5 - REST_CENTRE) * screenH;
  const [revealDone, setRevealDone] = useState(!booting);
  const alive = useSharedValue(0); // act 2: 0→1 once
  const breathe = useSharedValue(0); // act 2: 0↔1 forever
  const exit = useSharedValue(0); // act 3: 0→1 once
  // Held in a ref so the context value stays referentially stable — consumers
  // must not re-render when the reveal effect re-runs.
  const startRevealRef = useRef<(() => void) | null>(null);
  const signalFirstPaint = useCallback(() => startRevealRef.current?.(), []);

  useEffect(() => {
    if (reduceMotion) {
      // Reduce Motion means no MOTION, not a different composition. `alive`
      // now carries the resting layout as well as the animation, so leaving it
      // at 0 would strand these users on the pre-settle frame with no wordmark.
      // Snap to the end state instead: same picture, nothing moves.
      alive.value = 1;
      return;
    }
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
        { duration: reduceMotion ? DUR.base : DUR.feature, easing: EASE_REVEAL },
        (done) => {
          if (done) runOnJS(setRevealDone)(true);
        },
      );
    };
    startRevealRef.current = start;
    const cap = setTimeout(start, REVEAL_CAP_MS);
    return () => {
      clearTimeout(cap);
      startRevealRef.current = null;
      cancelAnimation(exit);
    };
  }, [booting, revealDone, exit, breathe, reduceMotion]);

  // The mark, its ember halo and the reveal ring must stay concentric, so the
  // lift lives on the group that holds all three rather than on the mark alone.
  // At alive=0 the group sits exactly where the OS splash puts the ink; at
  // alive=1 it has risen into the resting composition.
  const groupStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(alive.value, [0, 1], [FRAME1_DY, -restRise]) }],
  }));

  const logoStyle = useAnimatedStyle(() => ({
    // Gone by 55% of the reveal — the mark must never float over readable
    // app content while the stage dissolves behind it.
    opacity: interpolate(exit.value, [0, 0.2, 0.55], [1, 1, 0], Extrapolation.CLAMP),
    transform: [
      {
        scale:
          BASE_SCALE * // downscale from the 2× raster — never magnify
          interpolate(alive.value, [0, 1], [1, REST_SCALE]) * // settle to the rest size
          (1 + breathe.value * 0.012) * // barely-there breath
          interpolate(exit.value, [0, 1], [1, 1.3]), // bloom toward the viewer
      },
    ],
  }));

  // The wordmark belongs to the resting composition, so it arrives with it —
  // and only once Righteous has actually loaded. `booting` covers font loading,
  // so without this gate the first frames could paint "Mythique" in the system
  // fallback and then swap faces in place, which is exactly the kind of small
  // wrongness this screen cannot afford.
  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity:
      (fontsReady ? 1 : 0) *
      interpolate(alive.value, [0, 0.55, 1], [0, 0, 1], Extrapolation.CLAMP) *
      interpolate(exit.value, [0, 0.35], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(alive.value, [0, 1], [8, 0]) }],
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
        <SignalFirstPaintContext.Provider value={signalFirstPaint}>
          {children}
        </SignalFirstPaintContext.Provider>
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

          <Animated.View style={[styles.centre, groupStyle]} pointerEvents="none">
            {/* Ember halo. A real radial gradient (react-native-svg, as in
                NotFoundView) — three stacked translucent discs faking one gave
                visible hard edges where they met. */}
            <Animated.View style={[styles.haloWrap, haloStyle]}>
              <Svg width={HALO_W} height={HALO_H}>
                <Defs>
                  <RadialGradient id="boot-ember" cx="50%" cy="50%" r="50%">
                    <Stop offset="0" stopColor={COLORS.orange} stopOpacity={0.22} />
                    <Stop offset="0.55" stopColor={COLORS.orange} stopOpacity={0.08} />
                    <Stop offset="1" stopColor={COLORS.orange} stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Rect width={HALO_W} height={HALO_H} fill="url(#boot-ember)" />
              </Svg>
            </Animated.View>

            {/* Reveal ripple */}
            <Animated.View style={[styles.ring, ringStyle]} />

            <Animated.View style={logoStyle}>
              <Svg width={SVG_SIZE} height={SVG_SIZE} viewBox="0 0 1024 1024">
                <Path d={LOGO_PATH} fill={COLORS.beige} />
              </Svg>
            </Animated.View>
          </Animated.View>

          {/* The wordmark sits in the footer, not under the mark — the mark
              carries the top of the composition and this anchors the bottom. */}
          <Animated.View
            style={[
              styles.wordmarkWrap,
              { bottom: insets.bottom + WORDMARK_BOTTOM },
              wordmarkStyle,
            ]}
            pointerEvents="none"
          >
            <Text style={styles.wordmark}>Mythique</Text>
          </Animated.View>
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
  centre: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmarkWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  // Righteous lowercase is the brand's quiet-authority voice — the same face
  // the share cards use (SHARE_CARD.wordmarkFamilyRN), never coloured.
  wordmark: {
    fontFamily: 'Righteous_400Regular',
    fontSize: WORDMARK_SIZE,
    lineHeight: WORDMARK_SIZE * 1.3,
    color: COLORS.beige,
    letterSpacing: 0.5,
  },
  haloWrap: {
    position: 'absolute',
    width: HALO_W,
    height: HALO_H,
    alignItems: 'center',
    justifyContent: 'center',
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
