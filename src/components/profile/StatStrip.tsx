import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, PAPER_TEXT } from '../../constants/colors';
import type { ProfileStat } from '../../lib/profile/stats';

/**
 * The fan's stat block — the signature of the profile "dossier". Renders the
 * at-a-glance stats (saved, battles, streak, crowd %, badges) as one framed
 * instrument panel of hairline-divided cells, echoing a character's power-stat
 * block, rather than a scatter of separate chips. Empty → renders nothing.
 */
export function StatStrip({
  stats,
  onPressStat,
}: {
  stats: ProfileStat[];
  onPressStat?: (key: ProfileStat['key']) => void;
}) {
  if (stats.length === 0) return null;

  return (
    <View style={styles.block}>
      {stats.map((s, i) => {
        const inner = (
          <>
            {s.loading ? (
              <View style={styles.skeleton} />
            ) : (
              <View style={styles.valueRow}>
                {s.key === 'streak' && (
                  <Ionicons name="flame" size={15} color={COLORS.orange} style={styles.flame} />
                )}
                <Text style={styles.value}>{s.value}</Text>
              </View>
            )}
            <Text style={styles.label} numberOfLines={1}>
              {s.label}
            </Text>
          </>
        );
        const cellStyle = [styles.cell, i > 0 && styles.cellDivider];
        return onPressStat ? (
          <Pressable
            key={s.key}
            onPress={() => onPressStat(s.key)}
            style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [
              cellStyle,
              hovered && styles.cellHover,
            ]}
          >
            {inner}
          </Pressable>
        ) : (
          <View key={s.key} style={cellStyle}>
            {inner}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    backgroundColor: '#fbf3ea',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0e2d0',
    overflow: 'hidden',
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  cellDivider: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: '#ecdcc7',
  },
  cellHover: { backgroundColor: '#fdece0' } as object,
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  flame: { marginTop: 1 },
  value: {
    fontFamily: 'Flame-Regular',
    fontSize: 21,
    lineHeight: 26, // ≥ 1.22× fontSize for Flame descenders
    color: COLORS.navy,
    fontVariant: ['tabular-nums'], // figures align across cells
  },
  skeleton: {
    width: 24,
    height: 21,
    borderRadius: 6,
    backgroundColor: 'rgba(41,60,67,0.10)',
  },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: PAPER_TEXT.faint,
    marginTop: 4,
    textAlign: 'center',
  },
});
