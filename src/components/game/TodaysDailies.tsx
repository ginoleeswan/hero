// Today's Dailies — the games-hub strip. One glance: your streak, the three
// daily surfaces, which are done. Sits on the ink stage (versus hub, both
// platforms — plain RN primitives). Completion checks come from the signed-in
// server calendar (useDailies); logged out, the strip still works as a launcher
// with the local puzzle streak folded in by the caller's screens elsewhere.
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { useDailies } from '../../hooks/useDailies';

interface DailyItem {
  key: 'puzzle' | 'debate' | 'team_battle';
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}

export function TodaysDailies({
  onPuzzle,
  onDebate,
  onTeamBattle,
}: {
  onPuzzle: () => void;
  onDebate: () => void;
  /** Omit while today's battle is still resolving — the chip hides. */
  onTeamBattle?: () => void;
}) {
  const { current, today } = useDailies();

  const items: DailyItem[] = [
    { key: 'debate', label: 'Daily Debate', icon: 'flash-outline', onPress: onDebate },
    { key: 'puzzle', label: 'Guess the Hero', icon: 'help-circle-outline', onPress: onPuzzle },
  ];
  if (onTeamBattle) {
    items.push({
      key: 'team_battle',
      label: 'Team Battle',
      icon: 'people-outline',
      onPress: onTeamBattle,
    });
  }
  const doneCount = items.filter((i) => today[i.key]).length;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Today’s Dailies</Text>
        <View style={styles.streak}>
          <Ionicons name="flame" size={13} color={current > 0 ? COLORS.orange : COLORS.grey} />
          <Text style={[styles.streakText, current === 0 && styles.streakZero]}>
            {current > 0 ? `${current}-day streak` : 'Start a streak'}
          </Text>
          {doneCount > 0 ? (
            <Text style={styles.doneCount}>
              {' '}
              · {doneCount}/{items.length} done
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.row}>
        {items.map((item) => {
          const done = today[item.key];
          return (
            <Pressable
              key={item.key}
              onPress={item.onPress}
              accessibilityRole="button"
              accessibilityLabel={`${item.label}${done ? ' — completed today' : ''}`}
              style={({ pressed }) => [styles.chip, done && styles.chipDone, pressed && styles.dim]}
            >
              <Ionicons
                name={done ? 'checkmark-circle' : item.icon}
                size={15}
                color={done ? COLORS.green : COLORS.goldAccent}
              />
              <Text style={[styles.chipText, done && styles.chipTextDone]} numberOfLines={1}>
                {item.label}
              </Text>
              {!done ? (
                <Ionicons name="chevron-forward" size={12} color="rgba(245,235,220,0.4)" />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.12)',
    backgroundColor: 'rgba(245,235,220,0.05)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  eyebrow: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(245,235,220,0.55)',
  },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  streakText: { fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: COLORS.beige },
  streakZero: { color: 'rgba(245,235,220,0.55)' },
  doneCount: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: 'rgba(245,235,220,0.55)' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.16)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 0,
  },
  chipDone: { borderColor: 'rgba(74,153,110,0.5)', backgroundColor: 'rgba(74,153,110,0.12)' },
  chipText: { fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: COLORS.beige },
  chipTextDone: { color: 'rgba(245,235,220,0.75)' },
  dim: { opacity: 0.7 },
});
