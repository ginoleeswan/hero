// The instrument cluster — one vital per lane, side by side, each deep-linking
// to the lane that owns it. Breadth of situational awareness in a single row:
// audience, catalog, backlog, moderation, spend, community. Wraps on narrow.
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../../../constants/colors';
import { CC, healthColor } from '../../format';

export interface Vital {
  key: string;
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint?: string;
  /** Optional delta chip, e.g. "+18%". */
  delta?: { text: string; up: boolean };
  onPress: () => void;
}

function VitalTile({ v }: { v: Vital }) {
  return (
    <Pressable style={styles.tile} onPress={v.onPress} accessibilityLabel={`${v.label}: ${v.value}`}>
      <View style={styles.head}>
        <Ionicons name={v.icon} size={13} color={v.tint ?? COLORS.navy} />
        <Text style={styles.label} numberOfLines={1}>
          {v.label}
        </Text>
      </View>
      <View style={styles.valueRow}>
        <Text style={[styles.value, v.tint ? { color: v.tint } : null]} numberOfLines={1}>
          {v.value}
        </Text>
        {v.delta ? (
          <View style={[styles.delta, v.delta.up ? styles.up : styles.down]}>
            <Ionicons
              name={v.delta.up ? 'caret-up' : 'caret-down'}
              size={9}
              color={v.delta.up ? COLORS.green : COLORS.red}
            />
            <Text style={[styles.deltaText, { color: v.delta.up ? COLORS.green : COLORS.red }]}>
              {v.delta.text}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export function VitalsCluster({ vitals }: { vitals: Vital[] }) {
  return (
    <View style={styles.row}>
      {vitals.map((v) => (
        <VitalTile key={v.key} v={v} />
      ))}
    </View>
  );
}

// Re-export the health ramp so a caller can tint the catalog vital consistently.
export { healthColor };

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    flexGrow: 1,
    flexBasis: 150,
    minWidth: 132,
    backgroundColor: CC.cardBg,
    backgroundImage: CC.card,
    borderWidth: 1,
    borderColor: CC.cardBorder,
    borderTopColor: CC.cardLightCatch,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 13,
    gap: 6,
    boxShadow: CC.cardShadow,
  } as object,
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: {
    flex: 1,
    fontFamily: 'Nunito_700Bold',
    fontSize: 10.5,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: COLORS.grey,
  },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  value: {
    fontFamily: 'Flame-Regular',
    fontSize: 24,
    lineHeight: 26,
    color: COLORS.black,
    fontVariant: ['tabular-nums'],
  },
  delta: { flexDirection: 'row', alignItems: 'center', gap: 1, borderRadius: 5, paddingHorizontal: 4, paddingVertical: 1 },
  up: { backgroundColor: 'rgba(63,157,106,0.14)' },
  down: { backgroundColor: 'rgba(209,80,63,0.14)' },
  deltaText: { fontFamily: 'Nunito_700Bold', fontSize: 10 },
});
