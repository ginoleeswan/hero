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
//               then it lunges — accelerating the whole way in — with its
//               LEFT EYE drawn
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
  withSpring,
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
import { BOOT_SIGNAL_FALLBACK } from '../../lib/bootSignal';
import { useBootSignal } from '../../hooks/useBootSignal';
import { DUR, SPRING_SETTLE } from '../../lib/nativeMotion';
// The reveal's geometry lives next door so its one hard rule — the curtain may
// not drop before the ink covers the screen — can be unit-tested.
import {
  curtainOpacity,
  eyeCentre,
  centringPull,
  markGrow,
  revealRamp,
  markBox,
  markRest,
  markSquash,
  LUNGE_AT,
  MARK_VIEWBOX,
  SEAT_AT,
} from '../../lib/bootGeometry';

const SPLASH_NAVY = '#293C43'; // must equal app.config.ts splash backgroundColor

const WORD_H = SPLASH_LOCKUP.wordW / WORDMARK_ASPECT;

/** Reused rather than allocated per frame in the Reduce Motion branch. */
const UNIT_SQUASH = { x: 1, y: 1 };

const AMBIENT_DELAY_MS = 150; // hold the flat splash match for a beat
const AMBIENT_MS = 560; // depth + ember waking up behind the mark
const BREATHE_MS = 2600; // full in-out breath
// A hit EVERY launch is a different brief from a good first impression: it has
// to be over before anyone could wish it were. 1400ms was paced for the first
// time you ever see it. What survives the twentieth is attack — a tight intake,
// a fast strike, and a payoff that still gets its full share.
const EXIT_MS = 1150; // recoil, lunge, and the mask settling over your face

// The exit's driver is LINEAR, and that is deliberate to the point of being
// the most important decision in the file. Every act of this sequence is
// defined in progress space and carries its OWN easing (smoothstep draw-back,
// exponential approach, decelerating seat), so a driver with a curve of its
// own does not add polish — it silently reweights how much time each act
// gets, and there is no place you can read what the result will be.
//
// EASE_REVEAL, which drove it originally, is bezier(0.22, 1, 0.36, 1): 96%
// done by the halfway point. Right for one property settling to one value,
// catastrophic here. Measured on the build that shipped it — recoil 46ms,
// lunge over by 126ms, breakthrough at 193ms, then ~900ms creeping through
// scales already off screen. Its replacement, inOut(quad), was better and
// still wrong: its ease-IN stretched a 4.5% draw-back across 465ms, which is
// under the threshold where a scale change reads as motion at all. The
// anticipation was invisible for the second time in a row.
//
// Linear makes the constants honest: progress IS the fraction of EXIT_MS, so
// LUNGE_AT = 0.2 means "the draw-back takes a fifth of the sequence" and can
// be checked against a stopwatch. One curve decides the motion; the driver
// just turns the handle.
const EASE_BOOT = Easing.linear;
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
const HOLD_MS = AMBIENT_DELAY_MS + AMBIENT_MS - 60;

// ...and a beat AFTER the signal, always. `signalFirstPaint` fires from the
// feed's first layout, which is the single busiest moment of the launch: the
// list is committing rows, images are decoding, the row cascade is starting.
// Beginning a 1.4s animation in that exact frame is how a smooth reveal ends
// up looking dropped — not because the animation is expensive (it runs on the
// UI thread) but because the commit it shares a frame with is. Letting the
// first commit land first costs a beat nobody notices and buys the whole
// reveal a clear runway.
const SETTLE_MS = 150;

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
  // What the screen knows: the day's lamp, and whether the day's game is still
  // waiting. Null until the local read lands (a couple of ms, against an ambient
  // that does not start for 150) — the ember is held back rather than shown in
  // the fallback colour and swapped underneath the user.
  const signal = useBootSignal();
  const ember = signal ?? BOOT_SIGNAL_FALLBACK;
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
  // The mark's box is cropped to the ink (MARK_VIEWBOX), so placing it is just
  // centring it: its centre IS the ink's centre, and both offsets are positive
  // on every device because the box is narrower than the screen.
  const box = markBox(screenW);
  const markLeft = (screenW - box.w) / 2;
  const markTop = markCY - box.h / 2;
  const restScale = markRest(box.w);

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
        { duration: reduceMotion ? DUR.base : EXIT_MS, easing: EASE_BOOT },
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
      const wait = reduceMotion ? 0 : Math.max(SETTLE_MS, HOLD_MS - since);
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
  // covers the screen and the curtain starts to drop (SEAT_AT). Felt, it is
  // the mask making contact with your
  // face; heard through the fingers it marks the single most important frame
  // of the sequence. Fired from an animated reaction because the moment is
  // defined by the animation's progress, not by any JS timer — and never under
  // Reduce Motion, where there is no flight to land.
  //
  // TWO beats, not one. A single tap at contact is an event; a soft load at the
  // bottom of the draw-back followed by a rigid strike is a gesture, and the
  // difference between the two is most of why one feels designed and the other
  // feels like a notification. The pair also tells your hand what your eye is
  // being told at exactly the same instants.
  const beats = useSharedValue(0);
  const fireLoadHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
  }, []);
  const fireContactHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(() => {});
  }, []);

  // The app does not ramp into place, it LANDS. A scale driven off `exit` is a
  // ramp no matter how it is eased — it arrives at 1.0 with the velocity the
  // curve happens to have and stops. Kicking a spring at the contact frame
  // instead gives the arrival its own physics: it overshoots a hair and settles,
  // which is the beat the whole sequence has been setting up. This is the
  // dopamine, and it is worth its own shared value.
  // Seeded from `booting`: on a warm launch where boot has already resolved the
  // stage never mounts, nothing ever kicks the spring, and a 0 here would
  // strand the app at 93% for the rest of the session.
  const land = useSharedValue(booting ? 0 : 1);
  const kickLanding = useCallback(() => {
    land.value = withSpring(1, SPRING_SETTLE);
  }, [land]);

  useAnimatedReaction(
    () => exit.value,
    (now, prev) => {
      if (reduceMotion || prev === null) return;
      if (beats.value < 1 && now >= LUNGE_AT && prev < LUNGE_AT) {
        beats.value = 1;
        runOnJS(fireLoadHaptic)();
      }
      if (beats.value < 2 && now >= SEAT_AT && prev < SEAT_AT) {
        beats.value = 2;
        runOnJS(fireContactHaptic)();
        runOnJS(kickLanding)();
      }
    },
    [reduceMotion, fireLoadHaptic, fireContactHaptic, kickLanding],
  );

  // The mark: breathes at rest, recoils, then lunges toward the viewer while
  // its left eye is drawn to the centre of the screen. The translation is a
  // lerp toward the eye's target rather than a true fixed-point scale, so it
  // starts at exactly zero — a fixed-point scale would be geometrically purer
  // and visually worse, because the mark would begin drifting on frame one.
  //
  // There is NO 3D tilt, and this is now a proven constraint rather than a
  // precaution. A perspective transform on this view clips the mask on device.
  // Established by A/B across four shipped builds: removed with the viewBox
  // crop and the clipping stopped; restored on its own and the clipping came
  // back; the build after that touched no geometry at all and it persisted.
  //
  // Reasoning about why did not help — the keystone is bounded, the near edge
  // stays at 16% of the camera distance, the tilt is level before any large
  // scale, and it clipped anyway. iOS rasterises a 3D-transformed layer
  // differently, and a mask that is magnified 30x afterwards is exactly the
  // case where that bites. Everything here is a plain 2D translate and scale.
  //
  // If the depth cue is wanted back, it has to come from an affine
  // approximation (a skew plus an axis-differential scale), not from
  // perspective. Do not simply try a smaller angle.
  const markStyle = useAnimatedStyle(() => {
    const grow = flies ? markGrow(exit.value, ramp) : 1;
    const breath = 1 + breathe.value * 0.012 * (1 - exit.value);
    // Where the eye sits with no correction applied...
    const eye = eyeCentre(grow * breath, screenW, markCY);
    // ...and how hard it is drawn toward the centre of the screen.
    const pull = flies ? centringPull(exit.value) : 0;
    const uniform = restScale * grow * breath;
    const squash = flies ? markSquash(exit.value) : UNIT_SQUASH;
    return {
      // Flying: the rim is off the display by the end, so this fade only has
      // to hide the last sliver of it — kept late and short so the screen
      // never spends long under a translucent beige wash. Standing still
      // (Reduce Motion): the mask has to leave WITH the curtain, because
      // nothing has carried it off screen. Holding the flying curve there left
      // the mask sitting at full opacity over the app for most of the
      // crossfade and then popping out in its last few milliseconds.
      opacity: flies
        ? interpolate(exit.value, [0, 0.92, 1], [1, 1, 0], Extrapolation.CLAMP)
        : 1 - exit.value,
      transform: [
        { translateX: pull * (screenW / 2 - eye.x) },
        { translateY: pull * (screenH / 2 - eye.y) },
        // Per-axis, so the mask can load and launch with some weight in it.
        // `markSquash` is 1/1 from SQUASH_DONE onward, so this is a uniform
        // scale everywhere the coverage rule applies.
        { scaleX: uniform * squash.x },
        { scaleY: uniform * squash.y },
      ],
    };
  });

  // Contact. One frame of warm light as the mask reaches your face, under the
  // same haptic — the eye is told what the hand is told. Kept to 14% and about
  // 150ms: enough to land the impact, far short of a camera flash, which is
  // where this device reads as cheap rather than physical.
  const contactStyle = useAnimatedStyle(() => ({
    opacity: flies
      ? interpolate(
          exit.value,
          [SEAT_AT - 0.04, SEAT_AT, SEAT_AT + 0.07],
          [0, 0.14, 0],
          Extrapolation.CLAMP,
        )
      : 0,
  }));

  // The wordmark is DRAWN IN by the breath, not shooed off the bottom of the
  // screen. It used to sink and fade on its own, which is a second thing
  // happening rather than a part of the first: during the draw-back the mask
  // contracts and the ember dims, so the wordmark rising and shrinking toward
  // the mask makes the whole screen participate in one gesture instead of
  // three. Same 230ms, considerably more intent.
  //
  // Under Reduce Motion it has to fade with everything else. The flying curve
  // is written in progress space, and a 220ms crossfade would have run it out
  // in the first 44ms — the same bug the mask's opacity had.
  const wordStyle = useAnimatedStyle(() => ({
    opacity: flies
      ? interpolate(exit.value, [0, LUNGE_AT], [1, 0], Extrapolation.CLAMP)
      : 1 - exit.value,
    transform: [
      {
        translateY: flies
          ? interpolate(exit.value, [0, LUNGE_AT * 1.3], [0, -20], Extrapolation.CLAMP)
          : 0,
      },
      {
        scale: flies
          ? interpolate(exit.value, [0, LUNGE_AT * 1.3], [1, 0.9], Extrapolation.CLAMP)
          : 1,
      },
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
  //
  // It also TRAVELS with the mask. It used to sit where the mark rested while
  // the mask flew off toward the centre of the screen, which is light detached
  // from the thing lighting up — the single most common way a glow reads as a
  // sticker rather than as illumination.
  const emberGain = signal === null ? 0 : signal.awaiting ? 1.45 : 0.75;
  const emberStyle = useAnimatedStyle(() => {
    const grow = flies ? markGrow(exit.value, ramp) : 1;
    const eye = eyeCentre(grow, screenW, markCY);
    const pull = flies ? centringPull(exit.value) : 0;
    // Lit when today's game is unfinished, calm once it is spent. The whole
    // mechanic: a notification with no notification, learned the way you learn
    // a room is occupied from the light under the door.
    const base = ambient.value * (0.4 + breathe.value * 0.18) * emberGain;
    return {
      opacity: flies
        ? base *
          interpolate(
            exit.value,
            [0, LUNGE_AT, 0.55, SEAT_AT + 0.08],
            // Dims into the draw-back, then blazes: the light goes with the
            // mask, so the anticipation is carried by the whole screen and not
            // by a 6% scale change nobody can see on its own.
            [1, 0.7, 2.4, 0],
            Extrapolation.CLAMP,
          )
        : // Reduce Motion: just leave with the curtain. The flying curve is
          // written in progress space, so on a 220ms crossfade it would dim and
          // then spike to 2.4x inside a fifth of a second — a brightness flash
          // delivered to precisely the people who asked for less of this.
          base * (1 - exit.value),
      transform: [
        { translateX: pull * (screenW / 2 - eye.x) },
        { translateY: pull * (screenH / 2 - eye.y) },
        {
          scale:
            (1 + breathe.value * 0.05) *
            (flies ? interpolate(exit.value, [0, SEAT_AT], [1, 7]) : 1),
        },
      ],
    };
  });

  // The app underneath is ALWAYS fully opaque — only the curtain fades. Fading
  // both at once averaged two translucent layers into a muddy grey wash. Its
  // scale settle is timed to the window in which it is actually visible through
  // the eye, so the push-through reads as the app rushing up to meet you.
  const appStyle = useAnimatedStyle(() => ({
    // No CLAMP on the top end: the spring is allowed to carry it a hair past
    // 1.0 and settle back. That overshoot is the landing, and clamping it away
    // would leave the same motion with the satisfaction filed off.
    transform: [{ scale: interpolate(land.value, [0, 1], [0.93, 1]) }],
  }));

  return (
    <View style={styles.root}>
      {/* appStyle outlives the stage on purpose. The landing spring is kicked at
          contact and is still settling when the reveal ends ~440ms later, so
          swapping to a static style at revealDone would snap the last percent
          off the overshoot — the pop, replaced by a pop. */}
      <Animated.View style={[styles.app, reduceMotion ? styles.appAtRest : appStyle]}>
        <SignalFirstPaintContext.Provider value={signalFirstPaint}>
          {children}
        </SignalFirstPaintContext.Provider>
      </Animated.View>

      {!revealDone && (
        <View
          style={StyleSheet.absoluteFill}
          pointerEvents={booting ? 'auto' : 'none'}
          // The stage is one image with one name. It used to announce itself
          // for free, because the wordmark was live <Text> — outlining it to a
          // path for the splash handoff silenced the entire screen, so a
          // VoiceOver user got an unlabelled void for the length of the boot.
          // Nothing inside is worth reading on its own (a mark, a wordmark and
          // two gradients), so the whole thing is a single labelled element.
          accessible
          accessibilityRole="image"
          accessibilityLabel={ember.awaiting ? "Mythique — today's game is waiting" : 'Mythique'}
          // ...and modal, so focus cannot wander into the app underneath while
          // the curtain is still over it. The stage unmounts at revealDone, so
          // this releases itself.
          accessibilityViewIsModal
        >
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
                  <Stop offset="0" stopColor={ember.ember} stopOpacity={0.22} />
                  <Stop offset="0.55" stopColor={ember.ember} stopOpacity={0.08} />
                  <Stop offset="1" stopColor={ember.ember} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Rect width={HALO_W} height={HALO_H} fill="url(#boot-ember)" />
            </Svg>
          </Animated.View>

          {/* The mark sits ABOVE the curtain, so the holes in its path are the
              aperture: whatever is under it shows through the eyes. */}
          <Animated.View
            style={[
              styles.abs,
              { left: markLeft, top: markTop, width: box.w, height: box.h },
              markStyle,
            ]}
            pointerEvents="none"
          >
            <Svg width={box.w} height={box.h} viewBox={MARK_VIEWBOX}>
              <Path d={LOGO_PATH} fill={COLORS.beige} />
            </Svg>
          </Animated.View>

          {/* Contact. Over everything, including the mask, because the light is
              in the room rather than on the object. */}
          <Animated.View
            style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.beige }, contactStyle]}
            pointerEvents="none"
          />

          {/* The wordmark anchors the bottom of the lockup. Outlined, not set:
              it is the same geometry the splash PNG was drawn from, so there is
              no font to load and no metrics to disagree about. */}
          <Animated.View
            style={[
              styles.wordBox,
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
  // Every absolutely-positioned box here declares its own width and height,
  // and every one of them fits on screen with positive offsets.
  //
  // The mark's box used to be a 512pt square centred on a 160pt mark, which
  // put it at left = -59.5 on a 393pt screen — hanging off both edges, three
  // quarters empty, and relying on nothing in the parent chain ever clamping
  // or clipping it. It got clipped. Declaring the width was not enough to fix
  // it, so the box is now cropped to the ink itself: smaller than the screen,
  // positioned with positive offsets, nothing to clamp and nothing to clip.
  abs: { position: 'absolute' },

  wordBox: { position: 'absolute', width: SPLASH_LOCKUP.wordW, height: WORD_H },
  halo: { position: 'absolute', width: HALO_W, height: HALO_H },
});
