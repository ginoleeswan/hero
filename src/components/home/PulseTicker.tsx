// src/components/home/PulseTicker.tsx — native auto-scrolling marquee strip.
// Two identical copies sit in a row; the track translates left by exactly one
// copy's width on a linear loop, so the seam is invisible. Mirrors the web
// PulseTicker's content (the web one uses a raw-DOM CSS keyframe; native drives
// it with Reanimated instead).
import { useEffect, useState } from 'react';
import { View, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { Text } from '../ui/Text';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
  useReducedMotion,
  withSequence,
} from 'react-native-reanimated';
import { useScreenFocused } from '../../hooks/useScreenFocused';
import { COLORS } from '../../constants/colors';

interface PulseTickerProps {
  heroCount: number;
  newlyAddedCount: number;
}

const SPEED = 45; // px per second — steady, readable drift

export function PulseTicker({ heroCount, newlyAddedCount }: PulseTickerProps) {
  const text = `${heroCount.toLocaleString()} Heroes & Villains  ·  Marvel, DC & Beyond  ·  Powers, Origins & First Appearances  ·  500+ Teams & Affiliations  ·  ${newlyAddedCount} Recently Added  ·  `;
  const [copyW, setCopyW] = useState(0);
  const tx = useSharedValue(0);
  // Under Reduce Motion the marquee never scrolls — the strip renders static.
  const reduced = useReducedMotion();
  // ...and it holds still while you are on another tab. NativeTabs keeps this
  // screen mounted, so without this the strip scrolls forever for nobody.
  const focused = useScreenFocused();

  const onCopyLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - copyW) > 1) setCopyW(w);
  };

  useEffect(() => {
    if (copyW <= 0 || reduced || !focused) return;
    const cycle = (copyW / SPEED) * 1000;
    const loop = () =>
      withRepeat(withTiming(-copyW, { duration: cycle, easing: Easing.linear }), -1, false);
    // Resuming has to be seamless, so it finishes the leg it was on before
    // handing over to the loop. `withRepeat` restarts each iteration from the
    // value the animation began at, so the loop can only be started from 0 —
    // hence the zero-duration snap between the two. That snap is invisible
    // BECAUSE the strip is two identical copies: at -copyW the second copy sits
    // exactly where the first began, so 0 and -copyW are the same picture.
    const from = tx.value;
    if (from < 0 && from > -copyW) {
      const remaining = ((copyW + from) / copyW) * cycle;
      tx.value = withSequence(
        withTiming(-copyW, { duration: remaining, easing: Easing.linear }),
        withTiming(0, { duration: 0 }),
        loop(),
      );
    } else {
      tx.value = 0;
      tx.value = loop();
    }
    return () => cancelAnimation(tx);
  }, [copyW, tx, reduced, focused]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));

  return (
    <View style={s.wrap} pointerEvents="none">
      <Animated.View style={[s.track, style]}>
        <Text style={s.text} numberOfLines={1} onLayout={onCopyLayout}>
          {text}
        </Text>
        <Text style={s.text} numberOfLines={1}>
          {text}
        </Text>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { backgroundColor: COLORS.orange, paddingVertical: 10, overflow: 'hidden' },
  track: { flexDirection: 'row', flexShrink: 0 },
  text: {
    flexShrink: 0,
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.88)',
  },
});
