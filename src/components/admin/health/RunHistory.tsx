// Run-history dashboard — KPI summary + per-day grouped runs + load-more.
import { useState } from 'react';
import { View, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Text } from '../../ui/Text';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import { getRunHeroes, type EnrichmentRun } from '../../../lib/db/catalogHealth';
import { relTime, runStatusColor, runSourceChip, runTypeLabel, dayKey, dayLabel } from './format';
import { Chip, StatTile, LoadMore, EmptyState } from './ui';

// Lazy-loaded list of the heroes a run touched (per-run audit). Click to open.
function RunHeroes({ runId }: { runId: number }) {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ['runHeroes', runId],
    queryFn: () => getRunHeroes(runId),
    staleTime: 60_000,
  });
  if (isLoading)
    return <ActivityIndicator size="small" color={COLORS.orange} style={{ marginVertical: 10 }} />;
  if (!data || data.length === 0) {
    return <Text style={styles.runHeroesEmpty}>No per-hero audit recorded for this run.</Text>;
  }
  return (
    <View style={styles.runHeroesWrap}>
      <Text style={styles.runHeroesHead}>
        {data.length} hero{data.length === 1 ? '' : 'es'}
      </Text>
      <View style={styles.runHeroesChips}>
        {data.map((h) => (
          <Pressable
            key={h.id}
            onPress={() => router.push(`/character/${h.id}`)}
            style={styles.runHeroChip}
          >
            <Text style={styles.runHeroChipText}>{h.name}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// A run + its expandable per-hero audit.
function RunRow({ run, narrow }: { run: EnrichmentRun; narrow: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable onPress={() => setOpen((v) => !v)} style={styles.runPressable}>
        <RunItem run={run} narrow={narrow} open={open} />
      </Pressable>
      {open ? <RunHeroes runId={run.id} /> : null}
    </View>
  );
}

// Compact labelled stat used by the mobile run cards.
function RunStat({ label, value, tint }: { label: string; value: string; tint: string }) {
  return (
    <View style={styles.runStatCell}>
      <Text style={[styles.runStatValue, { color: tint }]}>{value}</Text>
      <Text style={styles.runStatLabel}>{label}</Text>
    </View>
  );
}

// One run — a stacked card on mobile, a table row on desktop. Shared by the
// grouped list so both layouts stay in lockstep.
function RunItem({ run: r, narrow, open }: { run: EnrichmentRun; narrow: boolean; open: boolean }) {
  const c = runStatusColor(r.status);
  const src = runSourceChip(r.triggered_by);
  if (narrow) {
    return (
      <View style={styles.runCard}>
        <View style={styles.runCardHead}>
          <Ionicons
            name={open ? 'chevron-down' : 'chevron-forward'}
            size={14}
            color={COLORS.grey}
          />
          <Text style={styles.runCardType} numberOfLines={1}>
            {runTypeLabel(r.run_type)}
          </Text>
          <Text style={styles.runCardWhen}>{relTime(r.created_at)}</Text>
        </View>
        <View style={styles.runCardHead}>
          <Chip bg={c + '22'} fg={c} text={r.status} spinner={r.status === 'running'} capitalize />
          <Chip bg={src.bg} fg={src.fg} text={r.triggered_by} />
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
      <View style={styles.runWhen}>
        <Ionicons name={open ? 'chevron-down' : 'chevron-forward'} size={13} color={COLORS.grey} />
        <Text style={styles.runWhenText}>{relTime(r.created_at)}</Text>
      </View>
      <Text style={styles.runType} numberOfLines={1}>
        {runTypeLabel(r.run_type)}
      </Text>
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
    return <EmptyState text="No runs logged yet — hit “Run batch · 25”." />;
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
        <StatTile
          label={`Enriched · last ${runs.length}`}
          value={winDone.toLocaleString()}
          tint={COLORS.green}
        />
        <StatTile
          label="Failed"
          value={winFailed.toLocaleString()}
          tint={winFailed ? COLORS.red : COLORS.grey}
        />
        <StatTile
          label="Success rate"
          value={`${successRate}%`}
          tint={successRate >= 95 ? COLORS.green : successRate >= 80 ? COLORS.yellow : COLORS.red}
        />
        <StatTile
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
              <Text style={[styles.runType, styles.runHeadText]}>Pipeline</Text>
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
              <RunRow key={r.id} run={r} narrow={narrow} />
            ))}
          </View>
        </View>
      ))}

      {runs.length < total && (
        <LoadMore
          onPress={onLoadMore}
          loading={fetching}
          label={`Load more · ${runs.length} of ${total.toLocaleString()}`}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  // KPI summary row (tiles are the shared <StatTile>)
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4, marginBottom: 4 },

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
  runWhen: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  runWhenText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.black },
  runType: { flex: 1.3, fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.orange },
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

  // Expandable per-run audit
  runPressable: { cursor: 'pointer' } as object,
  runHeroesWrap: {
    backgroundColor: '#faf6ee',
    borderRadius: 10,
    padding: 11,
    marginTop: 4,
    marginBottom: 6,
    gap: 8,
  },
  runHeroesHead: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.grey,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  runHeroesChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  runHeroChip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.1)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  } as object,
  runHeroChipText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },
  runHeroesEmpty: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: COLORS.grey,
    marginVertical: 8,
    marginLeft: 4,
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
  runCardType: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.orange },
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
