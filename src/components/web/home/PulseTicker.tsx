import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../../constants/colors';

interface PulseTickerProps {
  heroCount: number;
  newlyAddedCount: number;
}

/**
 * Auto-scrolling marquee. Uses a CSS keyframe animation (via RNW's
 * `animationKeyframes`) rather than the JS `Animated` API: it runs on the
 * compositor, so it never stalls when the tab is backgrounded or rAF is
 * throttled. Two identical copies sit side by side and the track translates by
 * exactly -50% (one copy), so the loop is seamless at any text width.
 */
export function PulseTicker({ heroCount, newlyAddedCount }: PulseTickerProps) {
  const text = `${heroCount.toLocaleString()} Heroes & Villains  ·  Marvel, DC & Beyond  ·  Powers, Origins & First Appearances  ·  500+ Teams & Affiliations  ·  ${newlyAddedCount} Recently Added  ·  `;

  return (
    <View style={s.wrap} accessibilityElementsHidden>
      <View style={s.track as object}>
        <Text style={s.text} numberOfLines={1}>
          {text}
        </Text>
        <Text style={s.text} numberOfLines={1} aria-hidden>
          {text}
        </Text>
      </View>
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
    width: 'max-content',
    flexShrink: 0,
    animationKeyframes: {
      '0%': { transform: [{ translateX: '0%' }] },
      '100%': { transform: [{ translateX: '-50%' }] },
    },
    animationDuration: '32s',
    animationTimingFunction: 'linear',
    animationIterationCount: 'infinite',
  } as object,
  text: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.88)',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  } as object,
});
