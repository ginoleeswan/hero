import { useRef, useEffect, useState } from 'react';
import { View, Animated, StyleSheet, Text, Easing, type LayoutChangeEvent } from 'react-native';
import { COLORS } from '../../../constants/colors';

interface PulseTickerProps {
  heroCount: number;
  newlyAddedCount: number;
}

// Scroll speed in px/sec — duration is derived from the measured width so the
// pace stays constant regardless of how long the string is.
const SPEED = 60;

export function PulseTicker({ heroCount, newlyAddedCount }: PulseTickerProps) {
  const text = `${heroCount.toLocaleString()} Heroes & Villains  ·  Marvel, DC & Beyond  ·  Powers, Origins & First Appearances  ·  500+ Teams & Affiliations  ·  ${newlyAddedCount} Recently Added  ·  `;
  const anim = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);

  // Measure the real rendered width of ONE copy. The loop translates by exactly
  // this distance, at which point the second (identical) copy sits where the
  // first began — so the reset to 0 is visually seamless.
  const onMeasure = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w && Math.abs(w - width) > 1) setWidth(w);
  };

  useEffect(() => {
    if (!width) return;
    anim.setValue(0);
    const loop = Animated.loop(
      Animated.timing(anim, {
        toValue: -width,
        duration: (width / SPEED) * 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [width, anim]);

  return (
    <View style={s.wrap} accessibilityElementsHidden>
      <Animated.View style={[s.track, { transform: [{ translateX: anim }] }] as object}>
        <Text style={s.text} numberOfLines={1} onLayout={onMeasure}>
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
  wrap: {
    backgroundColor: COLORS.orange,
    paddingVertical: 10,
    overflow: 'hidden',
  },
  track: {
    flexDirection: 'row',
  },
  text: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.88)',
    whiteSpace: 'nowrap',
  } as object,
});
