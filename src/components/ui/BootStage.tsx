// src/components/ui/BootStage.tsx — native boot choreography.
//
// The whole screen is one idea: YOU PUT THE MASK ON. You are looking at the
// Mythique mask; it recoils, lunges at you, and settles over your face — and
// the app is what the world looks like through its eye.
//
//   1. Still  — the first frame is the native splash, not a lookalike of it.
//               Both are drawn from the same lockup (SPLASH_LOCKUP): mark high,
//               wordmark low. Nothing assembles, because there is nothing to
//               assemble — the composition is already the thing you launched
//               into. Only the ambient wakes up: a depth gradient and an ember
//               halo fade in behind the mark, which breathes.
//   2. Open   — gated on the home feed's first paint (useSignalFirstPaint), and
//               never before HOLD_MS so a fast boot still gets the moment:
//               the wordmark sinks away while the mask draws back (RECOIL),
//               then it lunges — tipping in perspective so it moves through
//               space rather than inflating in place — with its LEFT EYE drawn
//               to the centre of the screen. Once its ink covers the display,
//               the navy curtain behind it drops (with a single haptic tap: the
//               mask making contact) and what shows through the eye hole is the
//               app. The eye keeps opening past the screen — the mask passing
//               your head as you put it on.
//
// The aperture is real geometry, not a mask layer: LOGO_MASK_PATH's eyes are
// holes in the filled path, so anything drawn under the mark shows through
// them. That is why the curtain's opacity is keyed to the mark's SCALE rather
// than to elapsed time — the curtain may only drop once the ink genuinely
// covers the screen, which is a fact about the geometry and the device's
// height, not about the clock.
//
// Honors Reduce Motion: no fly-through, no breath — a plain crossfade handoff.
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
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
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
import {
  LOGO_MASK_PATH as LOGO_PATH,
  SPLASH_LOCKUP,
  WORDMARK_ASPECT,
  WORDMARK_PATH,
  WORDMARK_VIEW_H,
} from '../../constants/logo';
import { COLORS } from '../../constants/colors';
import { DUR, EASE_REVEAL } from '../../lib/nativeMotion';
// The reveal's geometry lives next door so its one hard rule — the curtain may
// not drop before the ink covers the screen — can be unit-tested.
import {
  curtainOpacity,
  eyeCentre,
  centringPull,
  markGrow,
  revealRamp,
  GROW_AT,
  INK_CX,
  INK_CY,
  MARK_REST,
  MARK_SVG,
  UNIT,
} from '../../lib/bootGeometry';

const SPLASH_NAVY = '#293C43'; // must equal app.config.ts splash backgroundColor

const WORD_H = SPLASH_LOCKUP.wordW / WORDMARK_ASPECT;

const AMBIENT_DELAY_MS = 200; // hold the flat splash match for a beat
const AMBIENT_MS = 700; // depth + ember waking up behind the mark
const BREATHE_MS = 2600; // full in-out breath
const EXIT_MS = 1100; // recoil, lunge, and the mask settling over your face
const REVEAL_CAP_MS = 1400; // max wait for the feed's first paint after boot

// The FLOOR: the reveal may not begin before the composition has been held long
// enough to be READ. Without it the choreography only played on a cold start —
// the reveal is gated on the feed's first paint, and on a warm launch (fonts
// cached, no auth round-trip) that can land before the ambient has even faded
// in, turning the whole screen into a flash.
//
// Measured against a different clock from REVEAL_CAP_MS: this one runs from
// MOUNT, the cap runs from boot resolving. The reveal window is therefore
// [mount + HOLD_MS, bootResolved + REVEAL_CAP_MS].
const HOLD_MS = AMBIENT_DELAY_MS + AMBIENT_MS - 50;

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

export function BootStage({ booting, children }: { booting: boolean; children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [revealDone, setRevealDone] = useState(!booting);
  const ambient = useSharedValue(0); // act 1: 0→1 once
  const breathe = useSharedValue(0); // act 1: 0↔1 forever
  const exit = useSharedValue(0); // act 2: 0→1 once
  // Held in a ref so the context value stays referentially stable — consumers
  // must not re-render when the reveal effect re-runs.
  const startRevealRef = useRef<(() => void) | null>(null);
  // Mount time, for the HOLD_MS floor. A ref rather than state: reading it must
  // never re-render, and it is written exactly once. Stamped in an effect rather
  // than in `useRef(Date.now())` because reading the clock during render is
  // impure (react-hooks/purity) — and this is the more honest measurement
  // anyway, since it starts when the stage is actually on screen.
  const mountedAt = useRef(0);
  const signalFirstPaint = useCallback(() => startRevealRef.current?.(), []);

  // ── The lockup, reconstructed from the screen size ────────────────────────
  // expo-splash-screen renders assets/splash.png at `imageWidth` points wide,
  // centred, aspect preserved. Re-deriving that box here — rather than eyeing
  // percentages — is what makes the handoff a continuation instead of a cut.
  const boxTop = (screenH - SPLASH_LOCKUP.h) / 2;
  const markCY = boxTop + SPLASH_LOCKUP.markCY;
  // Place the mark's SVG box so its INK centre lands on the lockup's mark
  // position at rest. The transform origin is the box's centre, so the ink's
  // own offset within the viewBox has to be taken out here.
  const markLeft = screenW / 2 - MARK_SVG / 2 - (INK_CX - 512) * UNIT * MARK_REST;
  const markTop = markCY - MARK_SVG / 2 - (INK_CY - 512) * UNIT * MARK_REST;

  // The reveal's scale ramp, derived from this device's height.
  const ramp = revealRamp(screenH);

  // Declared before the reveal effect so it stamps first on mount.
  useEffect(() => {
    mountedAt.current = Date.now();
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      ambient.value = 1;
      return;
    }
    ambient.value = withDelay(
      AMBIENT_DELAY_MS,
      withTiming(1, { duration: AMBIENT_MS, easing: Easing.inOut(Easing.ease) }),
    );
    breathe.value = withDelay(
      AMBIENT_DELAY_MS + AMBIENT_MS / 2,
      withRepeat(
        withTiming(1, { duration: BREATHE_MS, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
    return () => {
      cancelAnimation(ambient);
      cancelAnimation(breathe);
    };
  }, [ambient, breathe, reduceMotion]);

  // The open: wait for the home feed's first paint (or the cap), hold the floor,
  // then run one exit timing. Gating on content is what makes the reveal land on
  // a real screen instead of a skeleton that immediately re-transitions.
  useEffect(() => {
    if (booting || revealDone) return;
    let started = false;
    let floor: ReturnType<typeof setTimeout> | null = null;
    const open = () => {
      cancelAnimation(breathe);
      exit.value = withTiming(
        1,
        { duration: reduceMotion ? DUR.base : EXIT_MS, easing: EASE_REVEAL },
        (done) => {
          if (done) runOnJS(setRevealDone)(true);
        },
      );
    };
    const start = () => {
      if (started) return;
      started = true; // claim the slot now, so the cap can't also fire
      // Reduce Motion has no choreography to protect, and holding those users on
      // a static screen would be delay without purpose.
      const since = mountedAt.current ? Date.now() - mountedAt.current : 0;
      const wait = reduceMotion ? 0 : Math.max(0, HOLD_MS - since);
      if (wait === 0) open();
      else floor = setTimeout(open, wait);
    };
    startRevealRef.current = start;
    const cap = setTimeout(start, REVEAL_CAP_MS);
    return () => {
      clearTimeout(cap);
      if (floor) clearTimeout(floor);
      startRevealRef.current = null;
      cancelAnimation(exit);
    };
  }, [booting, revealDone, exit, breathe, reduceMotion]);

  const flies = !reduceMotion;

  // One sharp tap at the breakthrough — the exact progress at which the ink
  // covers the screen and the curtain starts to drop (GROW_AT[3] is where the
  // ramp hands `cover` over). Felt, it is the mask making contact with your
  // face; heard through the fingers it marks the single most important frame
  // of the sequence. Fired from an animated reaction because the moment is
  // defined by the animation's progress, not by any JS timer — and never under
  // Reduce Motion, where there is no flight to land.
  const hapticFired = useSharedValue(0);
  const fireContactHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, []);
  useAnimatedReaction(
    () => exit.value,
    (now, prev) => {
      if (reduceMotion || hapticFired.value) return;
      if (now >= GROW_AT[3] && prev !== null && prev < GROW_AT[3]) {
        hapticFired.value = 1;
        runOnJS(fireContactHaptic)();
      }
    },
    [reduceMotion, fireContactHaptic],
  );

  // The mark: breathes at rest, recoils, then lunges toward the viewer while
  // its left eye is drawn to the centre of the screen. The translation is a
  // lerp toward the eye's target rather than a true fixed-point scale, so it
  // starts at exactly zero — a fixed-point scale would be geometrically purer
  // and visually worse, because the mark would begin drifting on frame one.
  //
  // The tilt is what makes this a FLIGHT rather than a zoom. Uniform scaling
  // reads as an image being enlarged; a small rotation under perspective reads
  // as an object moving through space. It leans back during the recoil, tips
  // hardest mid-lunge, and levels out as it reaches your face — a mask being
  // seated straight, not a card spinning. Kept out of bootGeometry because it
  // is aesthetic: no coverage rule depends on it (at its ~7° peak the ink
  // budget of `cover` absorbs the foreshortening many times over).
  const markStyle = useAnimatedStyle(() => {
    const grow = flies ? markGrow(exit.value, ramp) : 1;
    const scale = MARK_REST * grow * (1 + breathe.value * 0.012 * (1 - exit.value));
    // Where the eye sits with no correction applied...
    const eye = eyeCentre(scale, screenW, markCY);
    // ...and how hard it is drawn toward the centre of the screen.
    const pull = flies ? centringPull(exit.value) : 0;
    const tiltX = flies
      ? interpolate(exit.value, [0, 0.18, 0.45, 0.75], [0, -2.5, 5, 0], Extrapolation.CLAMP)
      : 0;
    const tiltY = flies
      ? interpolate(exit.value, [0, 0.18, 0.45, 0.75], [0, 2, -7, 0], Extrapolation.CLAMP)
      : 0;
    return {
      // The rim is off the display by the end, so this fade only has to hide
      // the last sliver of it; kept late and short so the screen never spends
      // long under a translucent beige wash.
      opacity: interpolate(exit.value, [0, 0.9, 1], [1, 1, 0], Extrapolation.CLAMP),
      transform: [
        { perspective: 1000 },
        { translateX: pull * (screenW / 2 - eye.x) },
        { translateY: pull * (screenH / 2 - eye.y) },
        { rotateX: `${tiltX}deg` },
        { rotateY: `${tiltY}deg` },
        { scale },
      ],
    };
  });

  // The wordmark sinks and fades before the mark moves — it hands the screen
  // over rather than being run over by it.
  const wordStyle = useAnimatedStyle(() => ({
    opacity: interpolate(exit.value, [0, 0.22], [1, 0], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(exit.value, [0, 0.3], [0, 26], Extrapolation.CLAMP) },
      { scale: interpolate(exit.value, [0, 0.3], [1, 0.94], Extrapolation.CLAMP) },
    ],
  }));

  // The curtain — everything behind the mark. Its opacity is keyed to the mark's
  // SCALE, not to time: it may only drop once the ink actually covers the
  // display, or the app would appear around the mark's edges instead of through
  // its eye. Recomputing the scale here rather than sharing it keeps the rule
  // legible at the point it is enforced.
  const curtainStyle = useAnimatedStyle(() => {
    if (!flies) return { opacity: 1 - exit.value };
    return { opacity: curtainOpacity(markGrow(exit.value, ramp), ramp) };
  });

  // Depth gradient fades in AFTER the flat splash-matched frame, so the handoff
  // moment stays identical to the OS splash's flat navy.
  const depthStyle = useAnimatedStyle(() => ({ opacity: ambient.value }));

  // The ember sits ABOVE the curtain and BELOW the mark, which makes one layer
  // do two jobs: at rest it is the warm bloom around the mark (and a faint
  // glow inside its eyes), and during the reveal it is the only thing visible
  // through the eye while the curtain is still up. Without it that stretch of
  // the flight was navy seen through navy — the mark grew, the screen went
  // flat, and the sense of being inside an eye was lost exactly when it should
  // have been strongest. It brightens as the eye rushes in, then hands over to
  // the app.
  const emberStyle = useAnimatedStyle(() => ({
    opacity:
      ambient.value *
      (0.4 + breathe.value * 0.18) *
      interpolate(exit.value, [0, 0.45, 0.72], [1, 2.4, 0], Extrapolation.CLAMP),
    transform: [{ scale: (1 + breathe.value * 0.05) * interpolate(exit.value, [0, 0.72], [1, 7]) }],
  }));

  // The app underneath is ALWAYS fully opaque — only the curtain fades. Fading
  // both at once averaged two translucent layers into a muddy grey wash. Its
  // scale settle is timed to the window in which it is actually visible through
  // the eye, so the push-through reads as the app rushing up to meet you.
  const appStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(exit.value, [0.5, 1], [0.94, 1], Extrapolation.CLAMP) }],
  }));

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.app, revealDone || reduceMotion ? styles.appAtRest : appStyle]}>
        <SignalFirstPaintContext.Provider value={signalFirstPaint}>
          {children}
        </SignalFirstPaintContext.Provider>
      </Animated.View>

      {!revealDone && (
        <View style={StyleSheet.absoluteFill} pointerEvents={booting ? 'auto' : 'none'}>
          <Animated.View style={[StyleSheet.absoluteFill, curtainStyle]} pointerEvents="none">
            <View style={[StyleSheet.absoluteFill, styles.flat]} />
            <Animated.View style={[StyleSheet.absoluteFill, depthStyle]}>
              <LinearGradient
                colors={['#2e444c', SPLASH_NAVY, '#1d2e35']}
                locations={[0, 0.42, 1]}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </Animated.View>

          {/* The ember. A real radial gradient (react-native-svg, as in
              NotFoundView) — three stacked translucent discs faking one gave
              visible hard edges where they met. */}
          <Animated.View
            style={[
              styles.halo,
              { left: screenW / 2 - HALO_W / 2, top: markCY - HALO_H / 2 },
              emberStyle,
            ]}
            pointerEvents="none"
          >
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

          {/* The mark sits ABOVE the curtain, so the holes in its path are the
              aperture: whatever is under it shows through the eyes. */}
          <Animated.View
            style={[styles.abs, { left: markLeft, top: markTop }, markStyle]}
            pointerEvents="none"
          >
            <Svg width={MARK_SVG} height={MARK_SVG} viewBox="0 0 1024 1024">
              <Path d={LOGO_PATH} fill={COLORS.beige} />
            </Svg>
          </Animated.View>

          {/* The wordmark anchors the bottom of the lockup. Outlined, not set:
              it is the same geometry the splash PNG was drawn from, so there is
              no font to load and no metrics to disagree about. */}
          <Animated.View
            style={[
              styles.abs,
              {
                left: screenW / 2 - SPLASH_LOCKUP.wordW / 2,
                top: boxTop + SPLASH_LOCKUP.wordCY - WORD_H / 2,
              },
              wordStyle,
            ]}
            pointerEvents="none"
          >
            <Svg
              width={SPLASH_LOCKUP.wordW}
              height={WORD_H}
              viewBox={`0 0 1000 ${WORDMARK_VIEW_H}`}
            >
              <Path d={WORDMARK_PATH} fill={COLORS.beige} />
            </Svg>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const HALO_W = 340;
const HALO_H = 190;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.deepNavy },
  app: { flex: 1 },
  appAtRest: { opacity: 1 },
  flat: { backgroundColor: SPLASH_NAVY },
  abs: { position: 'absolute' },
  halo: { position: 'absolute', width: HALO_W, height: HALO_H },
});
