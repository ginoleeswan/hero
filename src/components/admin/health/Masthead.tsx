// Catalog-health masthead — the full-bleed dark hero band (title, gauge, stats).
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import { TOPBAR_HEIGHT } from '../../web/TopBar';
import type { CatalogHealth, CoverageMetric } from '../../../lib/db/catalogHealth';
import { pct } from './format';
import { Gauge } from './charts';

function MastStat({
  value,
  label,
  tint,
  compact,
  onPress,
}: {
  value: string;
  label: string;
  tint?: string;
  compact?: boolean;
  onPress?: () => void;
}) {
  const body = (
    <>
      <Text style={[compact ? styles.mstatNumSm : styles.mstatNum, tint ? { color: tint } : null]}>
        {value}
      </Text>
      <Text style={[styles.mstatLabel, compact && styles.mstatLabelSm]}>{label}</Text>
    </>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.mstat, pressed && styles.mstatPressed]}>
        {body}
      </Pressable>
    );
  }
  return <View style={styles.mstat}>{body}</View>;
}

// Masthead stats strip — compact variant drops the dividers and shrinks the
// figures so it reads as a tidy single row on mobile. Coverage stats deep-link
// into the backfill worklist when onJump is supplied.
function Scoreboard({
  h,
  compact,
  onJump,
}: {
  h: CatalogHealth;
  compact?: boolean;
  onJump?: (metric: CoverageMetric) => void;
}) {
  const jumpPortrait = onJump ? () => onJump('portrait') : undefined;
  return (
    <View style={[styles.scoreboard, compact && styles.scoreboardNarrow]}>
      <MastStat compact={compact} value={h.total.toLocaleString()} label="Heroes" />
      {!compact && <View style={styles.scoreDivider} />}
      <MastStat
        compact={compact}
        onPress={jumpPortrait}
        value={`${pct(h.metrics.portrait, h.total)}%`}
        label="Portraits"
        tint={COLORS.orange}
      />
      {!compact && <View style={styles.scoreDivider} />}
      <MastStat
        compact={compact}
        onPress={jumpPortrait}
        value={(h.total - h.metrics.portrait).toLocaleString()}
        label="Awaiting"
        tint={COLORS.yellow}
      />
      {!compact && <View style={styles.scoreDivider} />}
      <MastStat compact={compact} value={`${h.byPublisher.length}`} label="Publishers" tint={COLORS.blue} />
    </View>
  );
}

export function Masthead({
  h,
  overall,
  narrow,
  refreshing,
  onRefresh,
  onJump,
}: {
  h?: CatalogHealth;
  overall: number;
  narrow: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onJump: (metric?: CoverageMetric) => void;
}) {
  return (
    <LinearGradient
      colors={['#10242e', COLORS.deepNavy]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.masthead, narrow && styles.mastheadNarrow]}
    >
      <View style={styles.mastheadGlow} />
      {narrow ? (
        // Mobile: a tight two-row hero — title beside a small gauge, then a
        // single compact stats strip. Kicker/subtitle/status-chips are
        // dropped (pending lives in the nav badge, failures in alerts).
        <View style={styles.mastheadInnerNarrow}>
          <View style={styles.mastHeadRow}>
            <View style={styles.mastHeadTitleCol}>
              <View style={styles.mastKickerRow}>
                <Text style={styles.kickerNarrow}>ARCHIVE CONTROL</Text>
                <Pressable onPress={onRefresh} hitSlop={8} style={styles.mastRefresh}>
                  {refreshing ? (
                    <ActivityIndicator size="small" color="rgba(255,255,255,0.85)" />
                  ) : (
                    <Ionicons name="refresh" size={15} color="rgba(255,255,255,0.85)" />
                  )}
                </Pressable>
              </View>
              <Text style={[styles.title, styles.titleNarrow]}>Catalog Health</Text>
            </View>
            {h && (
              <Pressable onPress={() => onJump()} accessibilityLabel="Go to backfill">
                <Gauge value={overall} size={76} />
              </Pressable>
            )}
          </View>
          {h && <Scoreboard h={h} compact onJump={onJump} />}
        </View>
      ) : (
        <View style={styles.mastheadInner}>
          <View style={styles.mastheadLeft}>
            <Text style={styles.kicker}>MYTHIQUE · ARCHIVE CONTROL</Text>
            <Text style={styles.title}>Catalog Health</Text>
            <Text style={styles.subtitle}>
              {h ? 'Live coverage across the archive' : 'Loading the archive…'}
            </Text>
            {h && <Scoreboard h={h} onJump={onJump} />}
            <View style={styles.statusRow}>
              {h &&
                Object.entries(h.cvStatus).map(([k, v]) => (
                  <View key={k} style={styles.statusChip}>
                    <View
                      style={[
                        styles.statusDot,
                        {
                          backgroundColor:
                            k === 'done' ? COLORS.green : k === 'failed' ? COLORS.red : COLORS.yellow,
                        },
                      ]}
                    />
                    <Text style={styles.statusChipText}>
                      {k} · {v.toLocaleString()}
                    </Text>
                  </View>
                ))}
            </View>
          </View>
          {h && (
            <Pressable onPress={() => onJump()} accessibilityLabel="Go to backfill">
              <Gauge value={overall} size={150} />
            </Pressable>
          )}
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  masthead: {
    width: '100%',
    overflow: 'hidden',
    paddingTop: (`calc(${TOPBAR_HEIGHT}px + env(safe-area-inset-top) + 30px)` as unknown) as number,
    paddingBottom: 30,
  },
  mastheadNarrow: { paddingBottom: 22 },
  mastheadInner: {
    width: '100%',
    maxWidth: 1080,
    alignSelf: 'center',
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 28,
  },
  mastheadInnerNarrow: { flexDirection: 'column', alignItems: 'flex-start', gap: 14, paddingHorizontal: 16 },
  mastheadGlow: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 320,
    height: 320,
    borderRadius: 320,
    backgroundColor: COLORS.orange,
    opacity: 0.14,
  },
  mastheadLeft: { gap: 6, flexShrink: 1 },
  kicker: { fontFamily: 'Nunito_700Bold', fontSize: 11, letterSpacing: 2.5, color: COLORS.orange },
  title: { fontFamily: 'Flame-Regular', fontSize: 46, color: '#fff', lineHeight: 50 },
  titleNarrow: { fontSize: 28, lineHeight: 31 },
  mastHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, alignSelf: 'stretch' },
  mastHeadTitleCol: { flex: 1, gap: 3 },
  mastKickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  mastRefresh: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  kickerNarrow: { fontFamily: 'Nunito_700Bold', fontSize: 10, letterSpacing: 2, color: COLORS.orange },
  subtitle: { fontFamily: 'Nunito_400Regular', fontSize: 15, color: 'rgba(255,255,255,0.6)' },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  statusDot: { width: 7, height: 7, borderRadius: 7 },
  statusChipText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  scoreboard: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 16, flexWrap: 'wrap' },
  scoreboardNarrow: {
    alignSelf: 'stretch',
    marginTop: 0,
    flexWrap: 'nowrap',
    justifyContent: 'space-between',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  scoreDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.13)' },
  mstat: { gap: 1 },
  mstatPressed: { opacity: 0.5 },
  mstatNum: { fontFamily: 'Flame-Regular', fontSize: 27, color: '#fff', lineHeight: 29 },
  mstatNumSm: { fontFamily: 'Flame-Regular', fontSize: 19, color: '#fff', lineHeight: 21 },
  mstatLabel: { fontFamily: 'Nunito_700Bold', fontSize: 11, letterSpacing: 0.4, color: 'rgba(255,255,255,0.5)' },
  mstatLabelSm: { fontSize: 9, letterSpacing: 0.2 },
});
