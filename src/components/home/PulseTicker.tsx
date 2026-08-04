// src/components/home/PulseTicker.tsx — native auto-scrolling marquee strip.
// Two identical copies sit in a row; the track translates left by exactly one
// copy's width on a linear loop, so the seam is invisible. Mirrors the web
// PulseTicker's content (the web one uses a raw-DOM CSS keyframe; native drives
// it with Reanimated instead).
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
  useReducedMotion,
} from 'react-native-reanimated';
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

  const onCopyLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - copyW) > 1) setCopyW(w);
  };

  useEffect(() => {
    if (copyW <= 0 || reduced) return;
    tx.value = 0;
    tx.value = withRepeat(
      withTiming(-copyW, { duration: (copyW / SPEED) * 1000, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(tx);
  }, [copyW, tx, reduced]);

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
