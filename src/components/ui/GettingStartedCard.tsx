import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';

const isWeb = Platform.OS === 'web';

export interface GettingStartedStep {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  done: boolean;
  onPress: () => void;
}

interface Props {
  steps: GettingStartedStep[];
}

/**
 * Onboarding checklist shown to signed-in users until every step is complete.
 * Renders nothing once all steps are done, so it quietly disappears for
 * established users. Drives cold-start engagement (save a hero, vote, etc.).
 */
export function GettingStartedCard({ steps }: Props) {
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <View style={styles.section}>
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Get started</Text>
            <Text style={styles.subtitle}>
              {doneCount} of {steps.length} done
            </Text>
          </View>
          <View style={styles.progressRing}>
            <Text style={styles.progressPct}>{pct}%</Text>
          </View>
        </View>

        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct}%` }]} />
        </View>

        <View style={styles.steps}>
          {steps.map((step) => (
            <Pressable
              key={step.id}
              onPress={step.done ? undefined : step.onPress}
              disabled={step.done}
              style={[styles.row, isWeb && !step.done && (styles.rowBtn as object)]}
            >
              <View style={[styles.check, step.done ? styles.checkDone : styles.checkTodo]}>
                <Ionicons
                  name={step.done ? 'checkmark' : step.icon}
                  size={15}
                  color={step.done ? '#fff' : COLORS.orange}
                />
              </View>
              <Text style={[styles.label, step.done && styles.labelDone]}>{step.label}</Text>
              {!step.done && (
                <Ionicons name="chevron-forward" size={16} color="rgba(41,60,67,0.3)" />
              )}
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 16, marginBottom: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  } as object,
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  headerText: { flex: 1 },
  title: { fontFamily: 'Flame-Regular', fontSize: 20, color: COLORS.navy },
  subtitle: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: COLORS.orange,
    marginTop: 2,
  },
  progressRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff5ee',
    borderWidth: 2,
    borderColor: '#fde0cc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressPct: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.orange },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#f0e7da',
    overflow: 'hidden',
    marginBottom: 14,
  },
  fill: { height: '100%', borderRadius: 3, backgroundColor: COLORS.orange },
  steps: { gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
  },
  rowBtn: { cursor: 'pointer' },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: { backgroundColor: COLORS.green },
  checkTodo: { backgroundColor: '#fff5ee', borderWidth: 1, borderColor: '#fde0cc' },
  label: {
    flex: 1,
    fontFamily: 'Nunito_700Bold',
    fontSize: 14.5,
    color: COLORS.navy,
  },
  labelDone: {
    color: 'rgba(41,60,67,0.4)',
    textDecorationLine: 'line-through',
  },
});
