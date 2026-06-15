import { useState } from 'react';
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../../constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SIDE = 20;
const GAP = 12;
const CARD_W = Math.round(SCREEN_WIDTH * 0.82);
const SNAP = CARD_W + GAP;

// A swipeable deck of "did you know" facts. Dark pull-quote cards that pop
// against the beige page — the one deliberately playful moment in the otherwise
// light, scannable character screen. Cards size to their text (the row takes the
// tallest), so nothing is clipped regardless of fact length.
// `contentInset` is accepted for parity with the web variant; native keeps its
// own SIDE padding unless an explicit inset is passed.
export function DidYouKnowDeck({
  facts,
  contentInset,
}: {
  facts: string[];
  contentInset?: number;
}) {
  const [active, setActive] = useState(0);
  if (facts.length === 0) return null;

  const single = facts.length === 1;

  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / SNAP);
    if (i !== active) {
      setActive(i);
      Haptics.selectionAsync();
    }
  };

  return (
    <View style={styles.wrap}>
      {single ? (
        <View style={styles.singleWrap}>
          <FactCard index={0} total={1} text={facts[0]} />
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={SNAP}
          snapToAlignment="start"
          decelerationRate="fast"
          contentContainerStyle={[
            styles.track,
            contentInset != null && { paddingHorizontal: contentInset },
          ]}
          onMomentumScrollEnd={onEnd}
        >
          {facts.map((f, i) => (
            <View key={i} style={styles.slot}>
              <FactCard index={i} total={facts.length} text={f} />
            </View>
          ))}
        </ScrollView>
      )}

      {!single ? (
        <View style={styles.dots} pointerEvents="none">
          {facts.map((_, i) => (
            <View key={i} style={[styles.dot, i === active && styles.dotActive]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function FactCard({ index, total, text }: { index: number; total: number; text: string }) {
  return (
    <View style={styles.card}>
      <MaterialCommunityIcons
        name="format-quote-open"
        size={40}
        color={COLORS.orange}
        style={styles.quote}
      />
      <View style={styles.cardHead}>
        <Text style={styles.index}>{String(index + 1).padStart(2, '0')}</Text>
        <Text style={styles.total}>/ {String(total).padStart(2, '0')}</Text>
      </View>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  track: { paddingHorizontal: SIDE, gap: GAP },
  slot: { width: CARD_W },
  singleWrap: { marginHorizontal: SIDE },
  card: {
    flex: 1,
    backgroundColor: COLORS.navy,
    borderRadius: 20,
    borderCurve: 'continuous',
    paddingTop: 18,
    paddingBottom: 20,
    paddingHorizontal: 18,
    gap: 14,
    overflow: 'hidden',
  },
  quote: { position: 'absolute', top: 10, right: 12, opacity: 0.22 },
  cardHead: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  index: {
    fontFamily: 'Nunito_900Black',
    fontSize: 22,
    color: COLORS.orange,
    letterSpacing: 0.5,
  },
  total: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: 'rgba(245,235,220,0.45)',
  },
  text: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 15.5,
    lineHeight: 23,
    color: COLORS.beige,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(41,60,67,0.22)' },
  dotActive: { width: 16, backgroundColor: COLORS.orange },
});
