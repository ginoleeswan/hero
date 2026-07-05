import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import type { ProfileStat } from '../../lib/profile/stats';

export function StatStrip({
  stats,
  onPressStat,
}: {
  stats: ProfileStat[];
  onPressStat?: (key: ProfileStat['key']) => void;
}) {
  if (stats.length === 0) return null;

  return (
    <View style={styles.row}>
      {stats.map((s) => {
        const inner = (
          <>
            {s.loading ? (
              <View style={styles.skeleton} />
            ) : (
              <View style={styles.valueRow}>
                {s.key === 'streak' && (
                  <Ionicons name="flame" size={16} color={COLORS.orange} style={styles.flame} />
                )}
                <Text style={styles.value}>{s.value}</Text>
              </View>
            )}
            <Text style={styles.label} numberOfLines={1}>
              {s.label}
            </Text>
          </>
        );
        return onPressStat ? (
          <Pressable key={s.key} onPress={() => onPressStat(s.key)} style={styles.tile}>
            {inner}
          </Pressable>
        ) : (
          <View key={s.key} style={styles.tile}>
            {inner}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    justifyContent: 'center',
    gap: 8,
  },
  tile: {
    flex: 1,
    maxWidth: 110,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.08)',
  },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  flame: { marginTop: 1 },
  value: {
    fontFamily: 'Flame-Regular',
    fontSize: 22,
    lineHeight: 27, // ≥ 1.22× fontSize for Flame descenders
    color: COLORS.navy,
  },
  skeleton: {
    width: 28,
    height: 22,
    borderRadius: 6,
    backgroundColor: 'rgba(41,60,67,0.10)',
  },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.grey,
    marginTop: 2,
    textAlign: 'center',
  },
});
