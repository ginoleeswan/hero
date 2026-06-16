import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import type { HeroPortrayals } from '../lib/db/people';

function Group({
  icon,
  label,
  names,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  names: string[];
}) {
  return (
    <View style={styles.group}>
      <View style={styles.groupHead}>
        <Ionicons name={icon} size={13} color={COLORS.orange} />
        <Text style={styles.groupLabel}>{label}</Text>
      </View>
      <View style={styles.chips}>
        {names.map((n) => (
          <View key={n} style={styles.chip}>
            <Text style={styles.chipText}>{n}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** "Portrayed By" — live-action performers + voice actors for a hero.
 *  Renders nothing when there's no data. The screen supplies the section header. */
export function PortrayedBySection({
  portrayals,
  contentInset = 20,
}: {
  portrayals: HeroPortrayals;
  contentInset?: number;
}) {
  const { performers, voiceActors } = portrayals;
  if (performers.length === 0 && voiceActors.length === 0) return null;
  return (
    <View style={{ paddingHorizontal: contentInset, gap: 16 }}>
      {performers.length > 0 ? (
        <Group icon="person" label="Live action" names={performers} />
      ) : null}
      {voiceActors.length > 0 ? <Group icon="mic" label="Voice" names={voiceActors} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 9 },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  groupLabel: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: COLORS.navy,
    opacity: 0.55,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: COLORS.navy + '0f',
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  chipText: { fontFamily: 'FlameSans-Regular', fontSize: 13, color: COLORS.navy },
});
