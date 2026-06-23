import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';
import type { PublisherFilter, AlignmentFilter } from '../../lib/db/heroes/types';

interface Props {
  publisher: PublisherFilter;
  alignment: AlignmentFilter;
  onPublisher: (p: PublisherFilter) => void;
  onAlignment: (a: AlignmentFilter) => void;
}

const PUBLISHERS: PublisherFilter[] = ['All', 'Marvel', 'DC'];
const ALIGNMENTS: AlignmentFilter[] = ['All', 'Heroes', 'Villains'];

/** Two server-side filter groups (publisher · alignment) above the roster grid —
 *  the draft screen's primary tool for taming a 3,000+ character pool. */
export function FilterChips({ publisher, alignment, onPublisher, onAlignment }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {PUBLISHERS.map((p) => (
        <Chip key={p} label={p} selected={publisher === p} onPress={() => onPublisher(p)} />
      ))}
      <View style={styles.divider} />
      {ALIGNMENTS.map((a) => (
        <Chip key={a} label={a} selected={alignment === a} onPress={() => onAlignment(a)} />
      ))}
    </ScrollView>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected ? styles.chipOn : styles.chipOff]}>
      <Text style={[styles.chipText, selected ? styles.chipTextOn : styles.chipTextOff]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 14,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  chipOn: { backgroundColor: COLORS.goldAccent, borderColor: COLORS.goldAccent },
  chipOff: { backgroundColor: 'transparent', borderColor: 'rgba(41,60,67,0.22)' },
  chipText: { fontFamily: 'Nunito_700Bold', fontSize: 12.5, letterSpacing: 0.3 },
  chipTextOn: { color: '#1a130a' },
  chipTextOff: { color: 'rgba(41,60,67,0.7)' },
  divider: { width: 1, height: 20, backgroundColor: 'rgba(41,60,67,0.16)', marginHorizontal: 2 },
});
