// src/components/search/AccentRail.tsx — horizontal hero rail with two header
// styles: a gold "sword" header (accent) or a plain uppercase label. Extracted
// from the opponent picker so Search and Pick share one rail.
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { OpponentCard } from '../compare/OpponentCard';
import type { PeekHero } from '../compare/HeroPeek';
import { COLORS, PAPER_TEXT } from '../../constants/colors';

const H_PAD = 16;
const RAIL_W = 116;
const RAIL_H = 158;

export interface AccentRailItem {
  id: string;
  name: string;
  image_url?: string | null;
  portrait_url?: string | null;
}

export function AccentRail({
  label,
  items,
  onPick,
  onPeek,
  accent,
  tagline,
}: {
  label: string;
  items: AccentRailItem[];
  onPick: (id: string) => void;
  onPeek: (item: PeekHero) => void;
  accent?: boolean;
  tagline?: string;
}) {
  return (
    <View style={styles.section}>
      {accent ? (
        <View style={styles.rivalHead}>
          <MaterialCommunityIcons name="sword-cross" size={15} color={COLORS.gold} />
          <Text style={styles.rivalLabel}>{label}</Text>
          <View style={styles.rivalBar} />
        </View>
      ) : (
        <Text style={styles.sectionLabel}>{label}</Text>
      )}
      {accent && tagline ? <Text style={styles.tagline}>{tagline}</Text> : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.railScroll}
        contentContainerStyle={styles.railRow}
      >
        {items.map((item) => (
          <OpponentCard
            key={item.id}
            item={item}
            onPress={() => onPick(item.id)}
            onLongPress={() => onPeek(item)}
            width={RAIL_W}
            height={RAIL_H}
            compact
            accent={accent}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 18 },
  sectionLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: PAPER_TEXT.faint,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginBottom: 11,
  },
  railScroll: { marginHorizontal: -H_PAD },
  railRow: { gap: 11, paddingLeft: H_PAD, paddingRight: H_PAD, paddingTop: 4, paddingBottom: 8 },
  rivalHead: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 3 },

  rivalLabel: {
    fontFamily: 'Flame-Regular',
    fontSize: 15,
    color: COLORS.gold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  rivalBar: { flex: 1, height: 2, borderRadius: 1, backgroundColor: 'rgba(176,125,0,0.28)' },
  tagline: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12.5,
    fontStyle: 'italic',
    color: PAPER_TEXT.faint,
    marginBottom: 11,
  },
});
