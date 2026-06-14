// Pipelines domain — the control room for every drain that fills the catalogue.
// Compact 2-D dashboard: pipeline cards (with ring gauges) sit beside the live
// activity log so running a drain and seeing its result need no scrolling; crons
// and the review queue pair below; full run history underneath.
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../../constants/colors';
import { Bento } from '../Bento';
import { Panel } from '../Panel';
import { RunHistory } from '../RunHistory';
import { ActivityLog } from '../ActivityLog';
import { HeroThumb } from '../atoms';
import type {
  AmbiguousHero,
  CatalogHealth,
  CronJob,
  EnrichmentProgress,
  EnrichmentRun,
} from '../../../../lib/db/catalogHealth';
import type { LogEntry } from '../format';

const pctOf = (have: number, total: number) => (total > 0 ? Math.round((have / total) * 100) : 0);

function Ring({ percent, size = 44, stroke = 5 }: { percent: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, percent / 100));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="#efe6d6" strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2} cy={size / 2} r={r} stroke={COLORS.orange} strokeWidth={stroke} fill="none"
          strokeDasharray={`${frac * c} ${c}`} strokeLinecap="round"
        />
      </Svg>
      <Text style={styles.ringText}>{percent}</Text>
    </View>
  );
}

interface Pipeline {
  key: string;
  name: string;
  blurb: string;
  have: number;
  total: number;
  note?: string;
  run?: { label: string; busyKey: string; onPress: () => void };
}

function PipelineCard({ p, busy }: { p: Pipeline; busy: string | null }) {
  const percent = pctOf(p.have, p.total);
  const running = p.run && busy === p.run.busyKey;
  return (
    <View style={styles.card}>
      <Ring percent={percent} />
      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={1}>{p.name}</Text>
        <Text style={styles.cardBlurb} numberOfLines={1}>{p.blurb}</Text>
      </View>
      {p.run ? (
        <Pressable onPress={p.run.onPress} disabled={!!busy} style={[styles.runBtn, !!busy && styles.dim]}>
          {running ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="play" size={12} color="#fff" />
          )}
          <Text style={styles.runText}>{p.run.label}</Text>
        </Pressable>
      ) : (
        <Text style={styles.note}>{p.note ?? 'auto'}</Text>
      )}
    </View>
  );
}

export function PipelinesDomain({
  h,
  progress,
  ambiguous,
  busy,
  batchSize,
  setBatchSize,
  crons,
  onRunDrain,
  onRetryFailed,
  onToggleAnyCron,
  onRunResolve,
  onRunEnrich,
  onResolveQid,
  runs,
  runsTotal,
  runsLoading,
  runsFetching,
  onLoadMore,
  log,
  clearLog,
  narrow,
}: {
  h: CatalogHealth;
  progress: EnrichmentProgress | undefined;
  ambiguous: AmbiguousHero[];
  busy: string | null;
  batchSize: number;
  setBatchSize: (n: number) => void;
  crons: CronJob[];
  onRunDrain: () => void;
  onRetryFailed: () => void;
  onToggleAnyCron: (jobname: string, enabled: boolean) => void;
  onRunResolve: () => void;
  onRunEnrich: () => void;
  onResolveQid: (id: string, qid: string, name: string) => void;
  runs: EnrichmentRun[];
  runsTotal: number;
  runsLoading: boolean;
  runsFetching: boolean;
  onLoadMore: () => void;
  log: LogEntry[];
  clearLog: () => void;
  narrow: boolean;
}) {
  const p = progress ?? {
    heroesTotal: 0, comicvineDone: 0, resolved: 0, ambiguous: 0, unresolved: 0,
    enriched: 0, filmTitles: 0, tvTitles: 0, gameTitles: 0,
  };
  const failed = h.cvStatus.failed ?? 0;

  const pipelines: Pipeline[] = [
    {
      key: 'comicvine', name: 'ComicVine', blurb: 'Core hero data',
      have: p.comicvineDone, total: p.heroesTotal,
      run: { label: `Run ${batchSize}`, busyKey: 'drain', onPress: onRunDrain },
    },
    {
      key: 'tmdb', name: 'TMDB · film', blurb: `${p.filmTitles.toLocaleString()} film titles`,
      have: p.filmTitles, total: p.filmTitles, note: 'cron',
    },
    {
      key: 'wd-resolve', name: 'Wikidata · resolve', blurb: 'Hero → QID identity',
      have: p.resolved, total: p.heroesTotal,
      run: { label: 'Resolve', busyKey: 'resolve', onPress: onRunResolve },
    },
    {
      key: 'wd-enrich', name: 'Wikidata · appearances', blurb: `${p.tvTitles}+${p.gameTitles} tv/game titles`,
      have: p.enriched, total: p.resolved,
      run: { label: 'Enrich', busyKey: 'enrich', onPress: onRunEnrich },
    },
  ];

  return (
    <Bento>
      {/* Top: controls + their live feedback, side by side. */}
      <Bento.Row narrow={narrow}>
        <Panel title="Pipelines" hint="Run a drain on demand; coverage shown in each ring." style={styles.flex15}>
          <View style={styles.grid}>
            {pipelines.map((pl) => (
              <View key={pl.key} style={styles.gridCell}>
                <PipelineCard p={pl} busy={busy} />
              </View>
            ))}
          </View>
          {/* ComicVine batch + retry, kept compact under the grid. */}
          <View style={styles.cvControls}>
            <Text style={styles.cvControlsLabel}>ComicVine batch</Text>
            <View style={styles.sizeSel}>
              {[10, 25, 50].map((n) => (
                <Pressable key={n} onPress={() => setBatchSize(n)} style={[styles.sizePill, batchSize === n && styles.sizePillOn]}>
                  <Text style={[styles.sizePillText, batchSize === n && styles.sizePillTextOn]}>{n}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              onPress={onRetryFailed}
              disabled={!!busy || failed === 0}
              style={[styles.ctrlBtn, (!!busy || failed === 0) && styles.dim]}
            >
              {busy === 'retry' ? (
                <ActivityIndicator size="small" color={COLORS.navy} />
              ) : (
                <Ionicons name="refresh" size={13} color={COLORS.navy} />
              )}
              <Text style={styles.ctrlText}>Retry failed{failed ? ` · ${failed}` : ''}</Text>
            </Pressable>
          </View>
        </Panel>

        <View style={styles.flex1}>
          <ActivityLog log={log} clearLog={clearLog} />
        </View>
      </Bento.Row>

      {/* Middle: scheduled automation + the human review queue. */}
      <Bento.Row narrow={narrow}>
        <Panel title="Scheduled crons" hint="Background jobs — stop or start any." style={styles.flex1}>
          {crons.length === 0 ? (
            <Text style={styles.empty}>No cron jobs scheduled.</Text>
          ) : (
            crons.map((c) => {
              const busyThis = busy === `cron-${c.jobname}`;
              return (
                <View key={c.jobname} style={styles.cronRow}>
                  <View style={[styles.cronDot, { backgroundColor: c.active ? COLORS.green : COLORS.grey }]} />
                  <View style={styles.cronInfo}>
                    <Text style={styles.cronName} numberOfLines={1}>{c.jobname}</Text>
                    <Text style={styles.cronMeta} numberOfLines={1}>
                      {c.schedule}{c.last_status ? ` · ${c.last_status}` : ''}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => onToggleAnyCron(c.jobname, !c.active)}
                    disabled={!!busy}
                    style={[styles.cronBtn, c.active ? styles.cronBtnStop : styles.cronBtnStart, !!busy && styles.dim]}
                  >
                    {busyThis ? (
                      <ActivityIndicator size="small" color={c.active ? COLORS.navy : '#fff'} />
                    ) : (
                      <Ionicons name={c.active ? 'pause' : 'play'} size={12} color={c.active ? COLORS.navy : '#fff'} />
                    )}
                    <Text style={[styles.cronBtnText, c.active ? styles.cronBtnTextStop : styles.cronBtnTextStart]}>
                      {c.active ? 'Stop' : 'Start'}
                    </Text>
                  </Pressable>
                </View>
              );
            })
          )}
        </Panel>

        <Panel
          title="Needs attention"
          hint={ambiguous.length > 0 ? `${ambiguous.length} to review` : 'Human decisions land here'}
          style={styles.flex1}
        >
          {ambiguous.length === 0 ? (
            <Text style={styles.empty}>All clear — nothing waiting on you.</Text>
          ) : (
            ambiguous.map((hero) => {
              const busyThis = busy === `resolveqid-${hero.id}`;
              return (
                <View key={hero.id} style={styles.reviewRow}>
                  <View style={styles.reviewWho}>
                    <HeroThumb uri={hero.imageUrl} width={30} height={40} radius={6} />
                    <View style={styles.reviewMeta}>
                      <Text style={styles.reviewName} numberOfLines={1}>{hero.name}</Text>
                      <Text style={styles.reviewPub} numberOfLines={1}>{hero.publisher ?? '—'}</Text>
                    </View>
                  </View>
                  <View style={styles.candidates}>
                    {hero.candidates.map((c) => (
                      <Pressable
                        key={c.qid}
                        onPress={() => onResolveQid(hero.id, c.qid, hero.name)}
                        disabled={!!busy}
                        style={[styles.chip, !!busy && styles.dim]}
                      >
                        <Text style={styles.chipText}>{busyThis ? '…' : `${c.qid} · ${c.score.toFixed(2)}`}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              );
            })
          )}
        </Panel>
      </Bento.Row>

      {/* Bottom: full run history across every drain. */}
      <Panel title="Run history" hint={`${runsTotal.toLocaleString()} runs · cron + manual · auto-refreshes`}>
        <RunHistory
          runs={runs}
          total={runsTotal}
          narrow={narrow}
          loading={runsLoading}
          fetching={runsFetching}
          onLoadMore={onLoadMore}
        />
      </Panel>
    </Bento>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  flex15: { flex: 1.5 },

  // Ring gauge
  ringText: {
    position: 'absolute', fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy,
    fontVariant: ['tabular-nums'],
  },

  // Pipeline grid (2-up on wide, wraps to 1 when tight)
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridCell: { flexBasis: '47%', flexGrow: 1, minWidth: 200 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12,
    backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(41,60,67,0.08)',
  },
  cardBody: { flex: 1, gap: 2, minWidth: 0 },
  cardName: { fontFamily: 'Flame-Regular', fontSize: 13.5, color: COLORS.black },
  cardBlurb: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: COLORS.grey },
  runBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.orange,
    borderRadius: 8, paddingHorizontal: 11, paddingVertical: 7,
  },
  runText: { fontFamily: 'Nunito_700Bold', fontSize: 11.5, color: '#fff' },
  note: { fontFamily: 'Nunito_700Bold', fontSize: 10, color: COLORS.grey, textTransform: 'uppercase', letterSpacing: 0.6 },
  dim: { opacity: 0.4 },

  // ComicVine compact controls
  cvControls: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 12 },
  cvControlsLabel: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: COLORS.grey, textTransform: 'uppercase', letterSpacing: 0.6 },
  sizeSel: { flexDirection: 'row', backgroundColor: '#efe6d6', borderRadius: 10, padding: 3 },
  sizePill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  sizePillOn: { backgroundColor: '#fff' },
  sizePillText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.grey },
  sizePillTextOn: { color: COLORS.navy },
  ctrlBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#efe6d6',
    borderRadius: 9, paddingHorizontal: 11, paddingVertical: 7,
  },
  ctrlText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },

  // Crons
  cronRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(41,60,67,0.06)',
  },
  cronDot: { width: 8, height: 8, borderRadius: 8 },
  cronInfo: { flex: 1, minWidth: 0, gap: 2 },
  cronName: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.black },
  cronMeta: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: COLORS.grey, fontVariant: ['tabular-nums'] },
  cronBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 9,
    paddingHorizontal: 11, paddingVertical: 6,
  },
  cronBtnStart: { backgroundColor: COLORS.green },
  cronBtnStop: { backgroundColor: '#efe6d6' },
  cronBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 11.5 },
  cronBtnTextStart: { color: '#fff' },
  cronBtnTextStop: { color: COLORS.navy },

  // Needs attention
  empty: { fontFamily: 'Nunito_400Regular', fontSize: 13.5, color: COLORS.grey },
  reviewRow: {
    flexDirection: 'column', gap: 8, paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: 'rgba(41,60,67,0.06)',
  },
  reviewWho: { flexDirection: 'row', alignItems: 'center', gap: 9, minWidth: 0 },
  reviewMeta: { flex: 1, minWidth: 0 },
  reviewName: { fontFamily: 'Nunito_700Bold', fontSize: 13.5, color: COLORS.black },
  reviewPub: { fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: COLORS.grey },
  candidates: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: COLORS.navy + '12', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  chipText: { fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: COLORS.navy },
});
