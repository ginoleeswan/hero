import { View, Text, Pressable, StyleSheet } from 'react-native';
import { COLORS, PAPER_TEXT, INK_TEXT } from '../../constants/colors';
import type { PublisherFilter, AlignmentFilter } from '../../lib/db/heroes/types';

interface Props {
  publisher: PublisherFilter;
  alignment: AlignmentFilter;
  onPublisher: (p: PublisherFilter) => void;
  onAlignment: (a: AlignmentFilter) => void;
  /** 'light' for the beige sheet (native), 'dark' for the navy stage (web). */
  tone?: 'light' | 'dark';
}

const PUBLISHERS: PublisherFilter[] = ['All', 'Marvel', 'DC'];
const ALIGNMENTS: AlignmentFilter[] = ['All', 'Heroes', 'Villains'];

/** Two server-side filter groups (publisher · alignment) above the roster grid —
 *  the draft screen's primary tool for taming a 34,000+ character pool. */
export function FilterChips({
  publisher,
  alignment,
  onPublisher,
  onAlignment,
  tone = 'light',
}: Props) {
  const dark = tone === 'dark';
  const labelStyle = [styles.groupLabel, dark ? styles.groupLabelDark : null];
  return (
    <View style={styles.groups}>
      <View style={styles.group}>
        <Text style={labelStyle}>Publisher</Text>
        <View style={styles.chips}>
          {PUBLISHERS.map((p) => (
            <Chip
              key={p}
              label={p}
              dark={dark}
              selected={publisher === p}
              onPress={() => onPublisher(p)}
            />
          ))}
        </View>
      </View>
      <View style={styles.group}>
        <Text style={labelStyle}>Alignment</Text>
        <View style={styles.chips}>
          {ALIGNMENTS.map((a) => (
            <Chip
              key={a}
              label={a}
              dark={dark}
              selected={alignment === a}
              onPress={() => onAlignment(a)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function Chip({
  label,
  selected,
  dark,
  onPress,
}: {
  label: string;
  selected: boolean;
  dark: boolean;
  onPress: () => void;
}) {
  const off = dark ? styles.chipOffDark : styles.chipOff;
  const offText = dark ? styles.chipTextOffDark : styles.chipTextOff;
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected ? styles.chipOn : off]}>
      <Text style={[styles.chipText, selected ? styles.chipTextOn : offText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  groups: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 30, rowGap: 14 },
  group: { gap: 8 },
  groupLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: PAPER_TEXT.faint,
  },
  groupLabelDark: { color: INK_TEXT.faint },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
  chipOffDark: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(245,235,220,0.28)' },
  chipText: { fontFamily: 'Nunito_700Bold', fontSize: 12.5, letterSpacing: 0.3 },
  chipTextOn: { color: '#1a130a' },
  chipTextOff: { color: PAPER_TEXT.faint },
  chipTextOffDark: { color: 'rgba(245,235,220,0.78)' },
});
