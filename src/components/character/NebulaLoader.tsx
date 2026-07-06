import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
  { x: 0.32, y: 0.34, r: 0.42, c: '#3a2b8f', o: 0.42, layer: 0 }, // indigo
  { x: 0.7, y: 0.3, r: 0.34, c: '#6d2f8f', o: 0.4, layer: 0 }, // violet
  { x: 0.55, y: 0.6, r: 0.46, c: '#b0338f', o: 0.5, layer: 1 }, // magenta
  { x: 0.26, y: 0.64, r: 0.32, c: '#2f7f8f', o: 0.44, layer: 1 }, // teal
  { x: 0.8, y: 0.62, r: 0.28, c: '#b0556f', o: 0.4, layer: 1 }, // rose
];

const OVERSCAN = 48; // layers extend past the viewport so drift never bares an edge

function CloudLayer({ layer, w, h }: { layer: number; w: number; h: number }) {
  const W = w + OVERSCAN * 2;
  const H = h + OVERSCAN * 2;
  const clouds = CLOUDS.filter((c) => c.layer === layer);
  const rng = useMemo(() => mulberry32(layer === 0 ? 1337 : 7331), [layer]);
  const stars = useMemo(
    () =>
      Array.from({ length: layer === 0 ? 22 : 34 }, () => ({
        x: rng() * W,
        y: rng() * H,
        r: 0.5 + rng() * (layer === 0 ? 0.9 : 1.3),
        o: 0.25 + rng() * (layer === 0 ? 0.35 : 0.6),
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

  const driftBack = useSharedValue(0.5);
  const driftFront = useSharedValue(0.5);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (still) return;
    driftBack.value = withRepeat(
      withTiming(1, { duration: 13000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    driftFront.value = withRepeat(
      withTiming(0, { duration: 9000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    pulse.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.out(Easing.quad) }),
      -1,
    );
  }, [still, driftBack, driftFront, pulse]);

  const backStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: (driftBack.value - 0.5) * 26 },
      { translateY: (driftBack.value - 0.5) * 18 },
    ],
  }));
  const frontStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: (driftFront.value - 0.5) * 40 },
      { translateY: (0.5 - driftFront.value) * 30 },
    ],
  }));

  const coreR = 5;
  const range = 34;
  const ring1 = useAnimatedProps(() => {
    const p = pulse.value;
    return { r: coreR + p * range, opacity: (1 - p) * 0.45 };
  });
  const ring2 = useAnimatedProps(() => {
    const p = (pulse.value + 0.5) % 1;
    return { r: coreR + p * range, opacity: (1 - p) * 0.45 };
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
              <RadialGradient id="core" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="#fbeede" stopOpacity={0.95} />
                <Stop offset="100%" stopColor="#fbeede" stopOpacity={0} />
              </RadialGradient>
              <RadialGradient id="vignette" cx="50%" cy="50%" r="70%">
                <Stop offset="55%" stopColor={SURFACE.ink} stopOpacity={0} />
                <Stop offset="100%" stopColor={SURFACE.ink} stopOpacity={0.9} />
              </RadialGradient>
            </Defs>
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
