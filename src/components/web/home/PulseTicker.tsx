import { useRef, useEffect } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { COLORS } from '../../../constants/colors';

interface PulseTickerProps {
  heroCount: number;
  newlyAddedCount: number;
}

const CHAR_W = 9.5;

export function PulseTicker({ heroCount, newlyAddedCount }: PulseTickerProps) {
  const text = `${heroCount.toLocaleString()} Heroes & Villains  ·  Marvel, DC & Beyond  ·  Powers, Origins & First Appearances  ·  500+ Teams & Affiliations  ·  ${newlyAddedCount} Recently Added  ·  `;
  const contentW = text.length * CHAR_W;
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(anim, {
        toValue: -contentW,
        duration: 28000,
        useNativeDriver: true,
      }),
    ).start();
  }, [contentW]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={s.wrap} accessibilityElementsHidden>
      <Animated.Text
        style={[s.text, { transform: [{ translateX: anim }] }] as object}
        numberOfLines={1}
      >
        {text}
        {text}
      </Animated.Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: COLORS.orange,
    paddingVertical: 10,
    overflow: 'hidden',
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
