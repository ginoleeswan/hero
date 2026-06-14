// Run-history dashboard — KPI summary + per-day grouped runs + load-more.
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import type { EnrichmentRun } from '../../../lib/db/catalogHealth';
import { relTime, runStatusColor, runSourceChip, dayKey, dayLabel } from './format';
import { Chip } from './atoms';

// Compact labelled stat used by the mobile run cards.
function RunStat({ label, value, tint }: { label: string; value: string; tint: string }) {
  return (
    <View style={styles.runStatCell}>
      <Text style={[styles.runStatValue, { color: tint }]}>{value}</Text>
      <Text style={styles.runStatLabel}>{label}</Text>
    </View>
  );
}

// A KPI tile for the run-history summary (Enriched / Failed / Success / rate).
function KpiTile({ label, value, tint }: { label: string; value: string; tint: string }) {
  return (
    <View style={styles.kpiTile}>
      <Text style={[styles.kpiValue, { color: tint }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

// One run — a stacked card on mobile, a table row on desktop. Shared by the
// grouped list so both layouts stay in lockstep.
function RunItem({ run: r, narrow }: { run: EnrichmentRun; narrow: boolean }) {
  const c = runStatusColor(r.status);
  const src = runSourceChip(r.triggered_by);
  if (narrow) {
    return (
      <View style={styles.runCard}>
        <View style={styles.runCardHead}>
          <Chip bg={c + '22'} fg={c} text={r.status} spinner={r.status === 'running'} capitalize />
          <Chip bg={src.bg} fg={src.fg} text={r.triggered_by} />
          <Text style={styles.runCardWhen}>{relTime(r.created_at)}</Text>
        </View>
        <View style={styles.runCardStats}>
          <RunStat label="Done" value={`${r.done}`} tint={COLORS.green} />
          <RunStat
            label="Failed"
            value={`${r.failed}`}
            tint={r.failed ? COLORS.red : COLORS.grey}
          />
          <RunStat
            label="Retry"
            value={`${r.retry}`}
            tint={r.retry ? COLORS.yellow : COLORS.grey}
          />
          <RunStat
            label="Left"
            value={r.remaining != null ? r.remaining.toLocaleString() : '—'}
            tint={COLORS.navy}
          />
          <RunStat
            label="Took"
            value={r.duration_ms != null ? `${(r.duration_ms / 1000).toFixed(1)}s` : '—'}
            tint={COLORS.grey}
          />
        </View>
      </View>
    );
  }
  return (
    <View style={styles.runRow}>
      <Text style={styles.runWhen}>{relTime(r.created_at)}</Text>
      <View style={styles.runStatusCol}>
        <Chip bg={c + '22'} fg={c} text={r.status} spinner={r.status === 'running'} capitalize />
      </View>
      <View style={styles.runBy}>
        <Chip bg={src.bg} fg={src.fg} text={r.triggered_by} />
      </View>
      <Text style={[styles.runStat, { color: COLORS.green }]}>{r.done}</Text>
      <Text style={[styles.runStat, { color: r.failed ? COLORS.red : COLORS.grey }]}>
        {r.failed}
      </Text>
      <Text style={[styles.runStat, { color: r.retry ? COLORS.yellow : COLORS.grey }]}>
        {r.retry}
      </Text>
      <Text style={[styles.runStat, { color: COLORS.navy }]}>
        {r.remaining != null ? r.remaining.toLocaleString() : '—'}
      </Text>
      <Text style={styles.runDur}>
        {r.duration_ms != null ? `${(r.duration_ms / 1000).toFixed(1)}s` : '—'}
      </Text>
    </View>
  );
}

export function RunHistory({
  runs,
  total,
  narrow,
  loading,
  fetching,
  onLoadMore,
}: {
  runs: EnrichmentRun[];
  total: number;
  narrow: boolean;
  loading: boolean;
  fetching: boolean;
  onLoadMore: () => void;
}) {
  if (loading) return <ActivityIndicator color={COLORS.orange} style={{ marginTop: 16 }} />;
  if (runs.length === 0) {
    return <Text style={styles.empty}>No runs logged yet — hit “Run batch · 25”.</Text>;
  }

  // KPI summary over the loaded window.
  const winDone = runs.reduce((a, r) => a + r.done, 0);
  const winFailed = runs.reduce((a, r) => a + r.failed, 0);
  const successRate =
    winDone + winFailed > 0 ? Math.round((winDone / (winDone + winFailed)) * 100) : 100;
  const drained = runs.filter((r) => r.duration_ms && r.done > 0);
  const drainMs = drained.reduce((a, r) => a + (r.duration_ms ?? 0), 0);
  const drainDone = drained.reduce((a, r) => a + r.done, 0);
  const throughput = drainMs > 0 ? Math.round(drainDone / (drainMs / 60000)) : 0;

  // Bucket the loaded runs by day (runs are newest-first).
  const groups: { key: string; label: string; runs: EnrichmentRun[]; done: number }[] = [];
  for (const r of runs) {
    const key = dayKey(r.created_at);
    let g =
      groups.length && groups[groups.length - 1].key === key ? groups[groups.length - 1] : null;
    if (!g) {
      g = { key, label: dayLabel(r.created_at), runs: [], done: 0 };
      groups.push(g);
    }
    g.runs.push(r);
    g.done += r.done;
  }

  return (
    <>
      <View style={styles.kpiRow}>
        <KpiTile
          label={`Enriched · last ${runs.length}`}
          value={winDone.toLocaleString()}
          tint={COLORS.green}
        />
        <KpiTile
          label="Failed"
          value={winFailed.toLocaleString()}
          tint={winFailed ? COLORS.red : COLORS.grey}
        />
        <KpiTile
          label="Success rate"
          value={`${successRate}%`}
          tint={successRate >= 95 ? COLORS.green : successRate >= 80 ? COLORS.yellow : COLORS.red}
        />
        <KpiTile
          label="Throughput"
          value={throughput > 0 ? `${throughput}/min` : '—'}
          tint={COLORS.navy}
        />
      </View>

      {groups.map((g) => (
        <View key={g.key} style={styles.dayGroup}>
          <View style={styles.dayHead}>
            <Text style={styles.dayLabel}>{g.label}</Text>
            <Text style={styles.daySub}>
              {g.runs.length} run{g.runs.length === 1 ? '' : 's'} · {g.done.toLocaleString()}{' '}
              enriched
            </Text>
          </View>
          {!narrow && (
            <View style={styles.runHeadRow}>
              <Text style={[styles.runWhen, styles.runHeadText]}>When</Text>
              <Text style={[styles.runStatusCol, styles.runHeadText]}>State</Text>
              <Text style={[styles.runBy, styles.runHeadText]}>Source</Text>
              <Text style={[styles.runStat, styles.runHeadText]}>Done</Text>
              <Text style={[styles.runStat, styles.runHeadText]}>Failed</Text>
              <Text style={[styles.runStat, styles.runHeadText]}>Retry</Text>
              <Text style={[styles.runStat, styles.runHeadText]}>Left</Text>
              <Text style={[styles.runDur, styles.runHeadText]}>Took</Text>
            </View>
          )}
          <View style={narrow ? styles.runCards : undefined}>
            {g.runs.map((r) => (
              <RunItem key={r.id} run={r} narrow={narrow} />
            ))}
          </View>
        </View>
      ))}

      {runs.length < total && (
        <Pressable
          onPress={onLoadMore}
          disabled={fetching}
          style={[styles.loadMore, fetching && styles.dim]}
        >
          {fetching ? (
            <ActivityIndicator size="small" color={COLORS.navy} />
          ) : (
            <Ionicons name="chevron-down" size={15} color={COLORS.navy} />
          )}
          <Text style={styles.loadMoreText}>
            Load more · {runs.length} of {total.toLocaleString()}
          </Text>
        </Pressable>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  empty: { fontFamily: 'Nunito_400Regular', fontSize: 14, color: COLORS.grey, marginTop: 12 },
  dim: { opacity: 0.4 },

  // KPI tiles
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4, marginBottom: 4 },
  kpiTile: {
    flexGrow: 1,
    flexBasis: 120,
    minWidth: 110,
    backgroundColor: '#faf6ee',
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.06)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 13,
    gap: 2,
  },
  kpiValue: { fontFamily: 'Flame-Regular', fontSize: 24, lineHeight: 26 },
  kpiLabel: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: COLORS.grey },

  // Per-day grouping
  dayGroup: { marginTop: 16 },
  dayHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(41,60,67,0.08)',
  },
  dayLabel: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.black, letterSpacing: 0.3 },
  daySub: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: COLORS.grey },
  loadMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 16,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#efe6d6',
  },
  loadMoreText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.navy },

  // Desktop table
  runHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#efe6d6',
    marginTop: 4,
  },
  runHeadText: {
    color: COLORS.grey,
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 0.4,
  },
  runRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#f6f0e6',
  },
  runWhen: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.black },
  runStatusCol: { width: 96 },
  runBy: { width: 84 },
  runStat: { width: 58, textAlign: 'right', fontFamily: 'Nunito_700Bold', fontSize: 13 },
  runDur: {
    width: 64,
    textAlign: 'right',
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: COLORS.grey,
  },

  // Mobile run cards
  runCards: { gap: 10, marginTop: 8 },
  runCard: {
    backgroundColor: '#faf6ee',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.06)',
    padding: 14,
    gap: 12,
  },
  runCardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  runCardWhen: {
    marginLeft: 'auto',
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: COLORS.grey,
  },
  runCardStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  runStatCell: { alignItems: 'center', gap: 1, minWidth: 48 },
  runStatValue: { fontFamily: 'Flame-Regular', fontSize: 19, lineHeight: 21 },
  runStatLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 0.4,
    color: COLORS.grey,
    textTransform: 'uppercase',
  },
});
