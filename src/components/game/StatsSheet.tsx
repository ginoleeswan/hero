// End-of-round stats for the daily game: played / win% / streak, a Wordle-style
// guess-distribution chart (today's row highlighted), the global percentile, and
// share. Presented as a bottom sheet over the dark game screen. Shared native +
// web (RNW).
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { winPct, type GameStats } from '../../lib/game/stats';
import type { StreakState } from '../../lib/game/streak';

function Metric({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export function StatsSheet({
  visible,
  onClose,
  stats,
  streak,
  maxGuesses,
  todayGuess,
  percentile,
  copied,
  onShare,
}: {
  visible: boolean;
  onClose: () => void;
  stats: GameStats;
  streak: StreakState;
  maxGuesses: number;
  /** Guesses used today when won, for the highlighted row; null otherwise. */
  todayGuess: number | null;
  percentile: number | null;
  copied: boolean;
  onShare: () => void;
}) {
  const rows = Array.from({ length: maxGuesses }, (_, i) => i + 1);
  const max = Math.max(1, ...rows.map((k) => stats.dist[k] ?? 0));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.grabber} />
          <View style={styles.head}>
            <Text style={styles.title}>Statistics</Text>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={styles.close}
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={20} color={COLORS.beige} />
            </Pressable>
          </View>

          <View style={styles.metrics}>
            <Metric value={stats.played} label="Played" />
            <Metric value={`${winPct(stats)}%`} label="Win rate" />
            <Metric value={streak.current} label="Streak" />
            <Metric value={streak.max} label="Max" />
          </View>

          <Text style={styles.section}>Guess distribution</Text>
          <View style={styles.chart}>
            {rows.map((k) => {
              const count = stats.dist[k] ?? 0;
              const isToday = todayGuess === k;
              return (
                <View key={k} style={styles.barRow}>
                  <Text style={styles.barKey}>{k}</Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${Math.max((count / max) * 100, count > 0 ? 12 : 0)}%` },
                        isToday && styles.barFillToday,
                      ]}
                    >
                      <Text style={styles.barCount}>{count}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

          {percentile != null ? (
            <Text style={styles.percentile}>
              You beat <Text style={styles.percentileNum}>{percentile}%</Text> of players today.
            </Text>
          ) : null}

          <Pressable onPress={onShare} style={styles.shareBtn}>
            <Ionicons name="share-social-outline" size={16} color="#fff" />
            <Text style={styles.shareLabel}>{copied ? 'Copied!' : 'Share result'}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(5,9,13,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#0e2029',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderCurve: 'continuous',
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 36,
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.1)',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 460,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(245,235,220,0.25)',
    alignSelf: 'center',
    marginBottom: 14,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: { fontFamily: 'Flame-Regular', fontSize: 24, color: COLORS.beige },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245,235,220,0.08)',
  },
  metrics: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 22 },
  metric: { alignItems: 'center', flex: 1 },
  metricValue: { fontFamily: 'Flame-Regular', fontSize: 26, color: COLORS.beige },
  metricLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: 'rgba(245,235,220,0.5)',
    marginTop: 2,
    textAlign: 'center',
  },
  section: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(245,235,220,0.55)',
    marginBottom: 10,
  },
  chart: { gap: 6, marginBottom: 18 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barKey: {
    width: 12,
    textAlign: 'center',
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: 'rgba(245,235,220,0.7)',
  },
  barTrack: { flex: 1 },
  barFill: {
    minWidth: 22,
    height: 22,
    borderRadius: 5,
    backgroundColor: 'rgba(245,235,220,0.18)',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  barFillToday: { backgroundColor: COLORS.green },
  barCount: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.beige },
  percentile: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: 'rgba(245,235,220,0.75)',
    textAlign: 'center',
    marginBottom: 16,
  },
  percentileNum: { fontFamily: 'Nunito_700Bold', color: COLORS.orange },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.orange,
    borderRadius: 999,
    paddingVertical: 14,
  },
  shareLabel: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: '#fff', letterSpacing: 0.3 },
});
