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
//
// The colour transition is NOT done by animating the gradient's <Stop> —
// <Stop> is an SVG *definition* element (lives in <Defs>, describes a paint
// server) and renders no host view of its own. Reanimated attaches to native
// view instances; wrapping <Stop> in `createAnimatedComponent` and driving it
// with `useAnimatedProps` finds nothing to attach to and crashes on mount
// ("Cannot find host instance for this component"). So instead: two fully
// static <Svg> layers, one painted the outgoing colour and one the incoming
// colour, stacked absolutely, and the crossfade happens on the wrapping
// Animated.View's opacity — a real view, which Reanimated can drive. Each
// layer needs its OWN gradient id; two <Defs> sharing one id in the same
// native SVG tree collide and one silently wins.
import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

// Matches web's `transition: 'background-color 800ms ease'` on the orb.
const GLOW_MS = 800;

function GlowLayer({
  color,
  size,
  gradientId,
}: {
  color: string;
  size: number;
  gradientId: string;
}) {
  return (
    <Svg width={size} height={size}>
      <Defs>
        {/* Web's orb: a 320px disc under `filter: blur(80px)`. Per the Filter
            Effects spec the parameter IS the standard deviation — sigma = 80,
            not 40 as an earlier pass assumed. A disc of radius 160 convolved
            with sigma 80 peaks at 1 - e^-2 = 0.86 (energy is pushed outward,
            the core never stays full), reads ~0.44 at the original edge and
            dies by r = 320. Half the sigma made the core 16% hotter and the
            falloff twice as tight — which is precisely a "spotlight" where
            web has a haze. Box = 640 (2 x 320). */}
        <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={0.86} />
          <Stop offset="0.25" stopColor={color} stopOpacity={0.78} />
          <Stop offset="0.5" stopColor={color} stopOpacity={0.44} />
          <Stop offset="0.75" stopColor={color} stopOpacity={0.14} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={size} height={size} fill={`url(#${gradientId})`} />
    </Svg>
  );
}

export function SpotlightGlow({ color, size }: { color: string; size: number }) {
  const reduced = useReducedMotion();
  // The layer beneath is always painted the settled colour; the layer above
  // starts transparent, holds the new colour, and fades in on top of it — so
  // at any instant mid-crossfade the composite is a plain alpha blend of the
  // two colours, same as web's `transition: background-color`.
  const [prevColorProp, setPrevColorProp] = useState(color);
  const [base, setBase] = useState(color);
  const [incoming, setIncoming] = useState(color);
  const opacity = useSharedValue(1);

  // "Adjusting state when a prop changes" — done during render (React's own
  // pattern for this, not inside an effect: calling setState in an effect
  // body just to react to a prop change is a lint-flagged cascading render).
  // Advances the (base, incoming) pair by exactly one step per `color`
  // change; the crossfade animation itself is the effect below, which reacts
  // to `incoming` having actually changed rather than re-deriving it.
  if (color !== prevColorProp) {
    setPrevColorProp(color);
    setBase(incoming);
    setIncoming(color);
  }

  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      // First paint: base and incoming both equal the initial colour, so
      // there is nothing to crossfade — settle immediately rather than
      // running a redundant 800ms tween between two identical colours.
      mounted.current = true;
      opacity.value = 1;
      return;
    }
    if (reduced) {
      opacity.value = 1;
      return;
    }
    opacity.value = 0;
    opacity.value = withTiming(1, { duration: GLOW_MS });
  }, [incoming, reduced, opacity]);

  const topStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[styles.wrap, { width: size, height: size }]} pointerEvents="none">
      {/* Two <Defs> in one native SVG tree that share an id collide — the
          fixed "-base"/"-top" suffixes are what keep these apart; nothing
          else has to be unique between renders. */}
      <GlowLayer color={base} size={size} gradientId="spotlight-glow-base" />
      <Animated.View style={[StyleSheet.absoluteFill, topStyle]}>
        <GlowLayer color={incoming} size={size} gradientId="spotlight-glow-top" />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Deliberately NOT `position: 'absolute'` — the caller already positions
  // this component (see `glowLayer` in SpotlightDeck.tsx). This just needs
  // to be a plain (default `relative`) box so the top layer's `absoluteFill`
  // has something to fill.
  wrap: {},
});
