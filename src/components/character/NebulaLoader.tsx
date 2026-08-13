import { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '../ui/Text';
import Svg, { Circle, Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { INK_TEXT, SURFACE } from '../../constants/colors';

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Deterministic PRNG so the starfield is stable across renders.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Nebula clouds as fractions of the viewport; layer 0 = back (dim/slow), 1 = front.
const CLOUDS = [
  { x: 0.22, y: 0.3, r: 0.5, c: '#3a2b8f', o: 0.4, layer: 0 }, // indigo
  { x: 0.74, y: 0.26, r: 0.44, c: '#6d2f8f', o: 0.38, layer: 0 }, // violet
  { x: 0.5, y: 0.52, r: 0.62, c: '#4a1f96', o: 0.3, layer: 0 }, // deep central wash
  { x: 0.58, y: 0.62, r: 0.46, c: '#b0338f', o: 0.48, layer: 1 }, // magenta
  { x: 0.24, y: 0.66, r: 0.36, c: '#2f7f8f', o: 0.42, layer: 1 }, // teal
  { x: 0.82, y: 0.6, r: 0.32, c: '#b0556f', o: 0.4, layer: 1 }, // rose
  { x: 0.4, y: 0.22, r: 0.26, c: '#c86bb0', o: 0.34, layer: 1 }, // pink highlight
];

const OVERSCAN = 48; // layers extend past the viewport so drift never bares an edge

function CloudLayer({ layer, w, h }: { layer: number; w: number; h: number }) {
  const W = w + OVERSCAN * 2;
  const H = h + OVERSCAN * 2;
  const clouds = CLOUDS.filter((c) => c.layer === layer);
  const rng = useMemo(() => mulberry32(layer === 0 ? 1337 : 7331), [layer]);
  const stars = useMemo(
    () =>
      Array.from({ length: layer === 0 ? 34 : 52 }, () => ({
        x: rng() * W,
        y: rng() * H,
        r: 0.4 + rng() * (layer === 0 ? 0.9 : 1.4),
        o: 0.22 + rng() * (layer === 0 ? 0.35 : 0.62),
      })),
    [rng, W, H, layer],
  );
  return (
    <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
      <Defs>
        {clouds.map((c, i) => (
          <RadialGradient key={i} id={`cloud-${layer}-${i}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={c.c} stopOpacity={c.o} />
            <Stop offset="100%" stopColor={c.c} stopOpacity={0} />
          </RadialGradient>
        ))}
      </Defs>
      {clouds.map((c, i) => (
        <Circle
          key={i}
          cx={OVERSCAN + c.x * w}
          cy={OVERSCAN + c.y * h}
          r={c.r * Math.max(w, h)}
          fill={`url(#cloud-${layer}-${i})`}
        />
      ))}
      {stars.map((s, i) => (
        <Circle key={`s${i}`} cx={s.x} cy={s.y} r={s.r} fill="#f5ebdc" opacity={s.o} />
      ))}
    </Svg>
  );
}

// A lush cosmic nebula loading state — drifting radial clouds, a starfield, a
// pulsing central core, and an edge vignette. Reduced motion → a still frame.
export function NebulaLoader({ label = 'Mapping the universe…' }: { label?: string }) {
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const still = reducedMotion();

  // One continuous clock (0→1, looping, never reversing) drives everything.
  // Every derived motion uses INTEGER harmonics of it, so at the 1→0 wrap each
  // sine returns to phase and the whole scene flows seamlessly — no stutter.
  const clock = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    clock.value = withRepeat(withTiming(1, { duration: 28000, easing: Easing.linear }), -1, false);
  }, [still, clock]);

  const TAU = Math.PI * 2;
  // Back layer: a slow, wide orbit + a gentle breathe.
  const backStyle = useAnimatedStyle(() => {
    const a = clock.value * TAU;
    return {
      transform: [
        { translateX: Math.sin(a) * 24 },
        { translateY: Math.cos(a) * 18 },
        { scale: 1 + Math.sin(a * 2) * 0.03 },
      ],
    };
  });
  // Front layer: a tighter, faster counter-orbit (2×) offset in phase.
  const frontStyle = useAnimatedStyle(() => {
    const a = clock.value * TAU;
    return {
      transform: [
        { translateX: Math.sin(a * 2 + 1.3) * 36 },
        { translateY: Math.cos(a * 2 + 1.3) * 27 },
        { scale: 1 + Math.cos(a * 3) * 0.04 },
      ],
    };
  });

  const coreR = 5;
  const range = 36;
  // Rings emanate 8× per clock loop (~every 3.5s), continuous across the wrap.
  const ring1 = useAnimatedProps(() => {
    const p = (clock.value * 8) % 1;
    return { r: coreR + p * range, opacity: (1 - p) * 0.5 };
  });
  const ring2 = useAnimatedProps(() => {
    const p = (clock.value * 8 + 0.5) % 1;
    return { r: coreR + p * range, opacity: (1 - p) * 0.5 };
  });

  const cx = vp.w / 2;
  const cy = vp.h / 2;

  return (
    <View
      style={styles.root}
      onLayout={(e) => setVp({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {vp.w > 0 ? (
        <>
          <Animated.View style={[styles.layer, backStyle]}>
            <CloudLayer layer={0} w={vp.w} h={vp.h} />
          </Animated.View>
          <Animated.View style={[styles.layer, frontStyle]}>
            <CloudLayer layer={1} w={vp.w} h={vp.h} />
          </Animated.View>

          {/* core + rings + vignette (static position) */}
          <Svg width={vp.w} height={vp.h} style={StyleSheet.absoluteFill} pointerEvents="none">
            <Defs>
              <RadialGradient id="galaxy" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="#c9a8ff" stopOpacity={0.28} />
                <Stop offset="100%" stopColor="#c9a8ff" stopOpacity={0} />
              </RadialGradient>
              <RadialGradient id="core" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="#fbeede" stopOpacity={0.95} />
                <Stop offset="100%" stopColor="#fbeede" stopOpacity={0} />
              </RadialGradient>
              <RadialGradient id="vignette" cx="50%" cy="50%" r="72%">
                <Stop offset="34%" stopColor={SURFACE.ink} stopOpacity={0} />
                <Stop offset="82%" stopColor={SURFACE.ink} stopOpacity={0.7} />
                <Stop offset="100%" stopColor={SURFACE.ink} stopOpacity={1} />
              </RadialGradient>
            </Defs>
            <Circle cx={cx} cy={cy} r={Math.max(vp.w, vp.h) * 0.28} fill="url(#galaxy)" />
            <Circle cx={cx} cy={cy} r={22} fill="url(#core)" />
            <Circle cx={cx} cy={cy} r={3} fill="#fff7ec" />
            <AnimatedCircle
              cx={cx}
              cy={cy}
              stroke="#e7c6ff"
              strokeWidth={1.2}
              fill="none"
              animatedProps={ring1}
            />
            <AnimatedCircle
              cx={cx}
              cy={cy}
              stroke="#e7c6ff"
              strokeWidth={1.2}
              fill="none"
              animatedProps={ring2}
            />
            <Rect x={0} y={0} width={vp.w} height={vp.h} fill="url(#vignette)" />
          </Svg>
        </>
      ) : null}
      <Text style={styles.caption}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden', backgroundColor: SURFACE.ink, justifyContent: 'flex-end' },
  layer: {
    position: 'absolute',
    left: -OVERSCAN,
    top: -OVERSCAN,
    right: -OVERSCAN,
    bottom: -OVERSCAN,
  } as object,
  caption: {
    alignSelf: 'center',
    marginBottom: 40,
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: INK_TEXT.faint,
  },
});
