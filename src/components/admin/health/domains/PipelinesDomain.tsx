// Pipelines ("Build") domain — the control room for every drain that fills the
// catalogue. The enrichment funnel (shared-denominator stage bars + one "Build
// next N" action) sits beside "Needs you" review; the live log + recently-built
// pair below; crons and full-width run history collapse into Advanced.
import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../../constants/colors';
import { Bento } from '../Bento';
import { Panel } from '../Panel';
import { RunHistory } from '../RunHistory';
import { ActivityLog } from '../ActivityLog';
import { useRouter } from 'expo-router';
import { InfoTip } from '../InfoTip';
import { AddHeroesPanel } from '../AddHeroesPanel';
import { HeroThumb } from '../atoms';
import { getPendingBuildIds } from '../../../../lib/db/build';
import { relTime, runTypeLabel, type LogTone } from '../format';
import type {
  AmbiguousHero,
  CatalogHealth,
  CronJob,
  EnrichmentProgress,
  EnrichmentRun,
  RecentlyEnriched,
} from '../../../../lib/db/catalogHealth';
import type { LogEntry } from '../format';

const pctOf = (have: number, total: number) => (total > 0 ? Math.round((have / total) * 100) : 0);

/** Turn a cron expression into a short human phrase for the common cases. */
function humanizeCron(s: string): string {
  const parts = s.trim().split(/\s+/);
  if (parts.length !== 5) return s;
  const [min, hr] = parts;
  const everyMin = min.match(/^\*\/(\d+)$/);
  if (everyMin && hr === '*') return `every ${everyMin[1]} min`;
  if (min === '0' && hr === '*') return 'hourly';
  const everyHr = hr.match(/^\*\/(\d+)$/);
  if (min === '0' && everyHr) return `every ${everyHr[1]} h`;
  if (/^\d+$/.test(min) && /^\d+$/.test(hr)) return `daily ${hr.padStart(2, '0')}:${min.padStart(2, '0')}`;
  return s;
}

/** Plain-English description of what a scheduled job does, by name. */
function cronHelp(jobname: string): string {
  const n = jobname.toLowerCase();
  if (n.includes('comicvine')) return 'Automatically runs the ComicVine drain to keep core hero data (powers, bio, movies) filling in.';
  if (n.includes('tmdb')) return 'Automatically runs the TMDB drain to enrich film & TV media (posters, trailers, cast).';
  if (n.includes('wikidata') && n.includes('resolve')) return 'Automatically resolves heroes to their Wikidata identity (QID).';
  if (n.includes('wikidata')) return 'Automatically pulls cross-media appearances and cast from Wikidata for resolved heroes.';
  if (n.includes('snapshot')) return 'Captures a periodic catalogue-health snapshot that feeds the trend charts.';
  return 'A scheduled background job.';
}

interface Stage {
  key: string;
  name: string;
  tip: string;
  reached: number; // heroes that have passed this stage
  total: number; // shared denominator (all heroes) so the funnel reads true
  pending: number; // still actionable at this stage
  // Heroes stuck here that need a human or can't proceed (failed / review / unresolvable).
  stuck?: { label: string; tone: string } | null;
  run?: { busyKey: string; onPress: () => void } | null; // per-stage drain (power user)
  auto?: boolean; // runs itself (TMDB)
}

// One row of the vertical funnel: a stage, its bar (scaled to the shared total so
// the drop-off between stages is visible), its counts, and an optional "Run" drain.
function FunnelStage({ s, n, busy, bottleneck }: { s: Stage; n: number; busy: string | null; bottleneck: boolean }) {
  const pct = pctOf(s.reached, s.total);
  const running = !!s.run && busy === s.run.busyKey;
  return (
    <View style={styles.stRow}>
      <View style={styles.stBadge}><Text style={styles.stBadgeText}>{n}</Text></View>
      <View style={styles.stBody}>
        <View style={styles.stHead}>
          <Text style={styles.stName} numberOfLines={1}>{s.name}</Text>
          <InfoTip text={s.tip} size={13} />
          {bottleneck ? <Text style={styles.stBottleneck}>bottleneck</Text> : null}
          <Text style={styles.stCount}>{s.reached.toLocaleString()}<Text style={styles.stCountDim}> / {s.total.toLocaleString()}</Text></Text>
        </View>
        <View style={styles.stTrack}>
          <View style={[styles.stFill, { width: `${pct}%` }, bottleneck && styles.stFillWarn]} />
        </View>
        <View style={styles.stFoot}>
          {s.auto ? (
            <Text style={styles.stMeta}>auto · runs on a schedule</Text>
          ) : (
            <Text style={styles.stMeta}>
              {s.pending > 0 ? `${s.pending.toLocaleString()} pending` : 'clear'}
              {s.stuck ? <Text style={[styles.stStuck, { color: s.stuck.tone }]}>{`  ·  ${s.stuck.label}`}</Text> : null}
            </Text>
          )}
          {s.run ? (
            <Pressable
              onPress={s.run.onPress}
              disabled={!!busy || s.pending === 0}
              style={[styles.stRun, (!!busy || s.pending === 0) && styles.dim]}
              accessibilityLabel={`Run ${s.name} over the backlog`}
            >
              {running ? (
                <ActivityIndicator size="small" color={COLORS.navy} />
              ) : (
                <Ionicons name="play" size={11} color={COLORS.navy} />
              )}
              <Text style={styles.stRunText}>Run all</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export function PipelinesDomain({
  h,
  progress,
  ambiguous,
  ambiguousFetching,
  onLoadMoreAmbiguous,
  buildIds,
  setBuildIds,
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
  recentlyEnriched,
  log,
  clearLog,
  flash,
  onHeroesAdded,
  narrow,
}: {
  h: CatalogHealth;
  progress: EnrichmentProgress | undefined;
  ambiguous: AmbiguousHero[];
  ambiguousFetching: boolean;
  onLoadMoreAmbiguous: () => void;
  buildIds: string[] | null;
  setBuildIds: (ids: string[] | null) => void;
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
  recentlyEnriched: RecentlyEnriched[];
  log: LogEntry[];
  clearLog: () => void;
  flash: (msg: string, tone?: LogTone) => void;
  onHeroesAdded: () => void;
  narrow: boolean;
}) {
  const router = useRouter();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const p = progress ?? {
    heroesTotal: 0, comicvineDone: 0, resolved: 0, ambiguous: 0, unresolved: 0,
    enriched: 0, filmTitles: 0, tvTitles: 0, gameTitles: 0, mediaDone: 0,
  };
  const failed = h.cvStatus.failed ?? 0;
  const reviewN = ambiguous.length;

  const buildNextPending = async () => {
    const ids = await getPendingBuildIds(batchSize);
    if (ids.length === 0) { flash('Nothing pending to build.', 'info'); return; }
    setBuildIds(ids);
  };

  // Open a candidate's Wikidata page in a new tab so you can eyeball the match.
  const openWiki = (qid: string) => {
    if (typeof window !== 'undefined') window.open(`https://www.wikidata.org/wiki/${qid}`, '_blank', 'noopener');
  };

  // Pending (still actionable) at each stage, in funnel order.
  const cvPending = Math.max(0, p.heroesTotal - p.comicvineDone - failed);
  const resolvePending = Math.max(0, p.comicvineDone - p.resolved - p.ambiguous - p.unresolved);
  const appearPending = Math.max(0, p.resolved - p.enriched);
  // The whole enrichment backlog — what "Build" works through, one hero at a time.
  const totalActionable = cvPending + resolvePending + appearPending;

  // A true funnel: every actionable stage shares one denominator (all heroes), so
  // the drop-off between stages is visible. TMDB is a separate unit (titles), shown apart.
  const stages: Stage[] = [
    {
      key: 'comicvine', name: 'ComicVine', tip: 'Pulls each hero\'s core data — powers, bio, alter egos, movie list — from ComicVine. This is the gate: every later stage needs it done first.',
      reached: p.comicvineDone, total: p.heroesTotal, pending: cvPending,
      stuck: failed > 0 ? { label: `${failed} failed`, tone: COLORS.red } : null,
      run: { busyKey: 'drain', onPress: onRunDrain },
    },
    {
      key: 'resolve', name: 'Resolve identity', tip: 'Matches each hero to its single Wikidata identity (QID) using publisher, first-appearance year, creators and aliases. Uncertain matches go to "Needs you".',
      reached: p.resolved, total: p.heroesTotal, pending: resolvePending,
      stuck: reviewN > 0 ? { label: `${reviewN} need you`, tone: COLORS.yellow } : null,
      run: { busyKey: 'resolve', onPress: onRunResolve },
    },
    {
      key: 'appearances', name: 'Appearances & cast', tip: 'For resolved heroes, pulls cross-media appearances (film / TV / game) and who played or voiced them. Feeds the On-Screen shelves and Portrayed-By.',
      reached: p.enriched, total: p.heroesTotal, pending: appearPending,
      run: { busyKey: 'enrich', onPress: onRunEnrich },
    },
    {
      key: 'tmdb', name: 'TMDB media', tip: 'Adds posters, backdrops, trailers, cast and where-to-watch to matched film & TV titles. Runs itself on a schedule as Wikidata discovers new titles.',
      reached: p.mediaDone, total: Math.max(1, p.filmTitles + p.tvTitles), pending: 0, auto: true,
    },
  ];
  // Flag the actionable stage holding up the most heroes.
  const maxPending = Math.max(cvPending, resolvePending, appearPending);
  const bottleneckKey = maxPending > 0
    ? stages.find((s) => !s.auto && s.pending === maxPending)?.key
    : undefined;

  return (
    <Bento>
      {/* 1 · Add characters — name / team / series, multi-select, build live. */}
      <AddHeroesPanel flash={flash} onAdded={onHeroesAdded} onBuild={setBuildIds} />

      {/* 2 · Build & status — the funnel + one primary action, beside what needs you. */}
      <Bento.Row narrow={narrow}>
        <Panel
          title="Build & status"
          hint={`${p.enriched.toLocaleString()} of ${p.heroesTotal.toLocaleString()} fully enriched · ${totalActionable.toLocaleString()} to go`}
          action={<InfoTip text="The enrichment funnel. Each bar is how many heroes have reached that stage, all on the same scale, so you can see where they pile up. 'Build next' works the backlog one hero at a time; 'Run all' on a stage drains just that stage." />}
          style={styles.flex15}
        >
          <View style={styles.funnel}>
            {stages.map((s, i) => (
              <FunnelStage key={s.key} s={s} n={i + 1} busy={busy} bottleneck={s.key === bottleneckKey} />
            ))}
          </View>

          {/* Primary action: work the whole backlog, one hero at a time, live. */}
          <View style={styles.primary}>
            <Pressable
              onPress={buildNextPending}
              disabled={!!buildIds || totalActionable === 0}
              style={[styles.buildBtn, (!!buildIds || totalActionable === 0) && styles.dim]}
            >
              <Ionicons name="construct" size={16} color="#fff" />
              <Text style={styles.buildBtnText}>Build next {Math.min(batchSize, totalActionable || batchSize)}</Text>
            </Pressable>
            <View style={styles.sizeSel}>
              {[10, 25, 50].map((n) => (
                <Pressable key={n} onPress={() => setBatchSize(n)} style={[styles.sizePill, batchSize === n && styles.sizePillOn]}>
                  <Text style={[styles.sizePillText, batchSize === n && styles.sizePillTextOn]}>{n}</Text>
                </Pressable>
              ))}
            </View>
            <InfoTip text={`Opens the live Build board for the next ${batchSize} heroes in the backlog — you watch each go ComicVine → Resolve → Appearances, with Pause/Stop. The 10/25/50 sets how many. (Just-added characters get their own Build button up top.)`} size={13} />
            {failed > 0 ? (
              <Pressable
                onPress={onRetryFailed}
                disabled={!!busy}
                style={[styles.ctrlBtn, !!busy && styles.dim]}
              >
                {busy === 'retry' ? (
                  <ActivityIndicator size="small" color={COLORS.navy} />
                ) : (
                  <Ionicons name="refresh" size={13} color={COLORS.navy} />
                )}
                <Text style={styles.ctrlText}>Retry {failed} failed</Text>
              </Pressable>
            ) : null}
          </View>
        </Panel>

        <Panel
          title="Needs you"
          hint={p.ambiguous > 0 ? `${p.ambiguous.toLocaleString()} to review` : 'Decisions land here'}
          action={<InfoTip text="Heroes the resolver couldn't confidently match to one Wikidata identity. Each chip is a candidate (QID · confidence score) — click the correct one to lock it in, or the ↗ to eyeball it on Wikidata first." />}
          style={styles.flex1}
        >
          {ambiguous.length === 0 ? (
            <Text style={styles.empty}>All clear — nothing waiting on you.</Text>
          ) : (
            <ScrollView style={narrow ? styles.reviewScrollCap : styles.reviewScrollFill} nestedScrollEnabled showsVerticalScrollIndicator>
            {ambiguous.map((hero) => {
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
                      <View key={c.qid} style={styles.cand}>
                        <Pressable
                          onPress={() => onResolveQid(hero.id, c.qid, hero.name)}
                          disabled={!!busy}
                          style={[styles.chip, !!busy && styles.dim]}
                          accessibilityLabel={`Pick ${c.qid} for ${hero.name}`}
                        >
                          <Text style={styles.chipText}>{busyThis ? '…' : `${c.qid} · ${c.score.toFixed(2)}`}</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => openWiki(c.qid)}
                          style={styles.chipLink}
                          accessibilityLabel={`Open ${c.qid} on Wikidata to verify`}
                        >
                          <Ionicons name="open-outline" size={13} color={COLORS.navy} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
            {ambiguous.length < p.ambiguous ? (
              <Pressable
                onPress={onLoadMoreAmbiguous}
                disabled={ambiguousFetching}
                style={[styles.loadMore, ambiguousFetching && styles.dim]}
              >
                {ambiguousFetching ? (
                  <ActivityIndicator size="small" color={COLORS.navy} />
                ) : (
                  <Ionicons name="chevron-down" size={14} color={COLORS.navy} />
                )}
                <Text style={styles.loadMoreText}>
                  Load more · {(p.ambiguous - ambiguous.length).toLocaleString()} left
                </Text>
              </Pressable>
            ) : null}
            </ScrollView>
          )}
        </Panel>
      </Bento.Row>

      {/* 3 · Monitor — live log + who just got built. */}
      <Bento.Row narrow={narrow}>
        <View style={styles.flex1}>
          <ActivityLog log={log} clearLog={clearLog} />
        </View>
        <Panel
          title="Recently built"
          hint="The exact heroes each run just touched — click one to open it."
          action={<InfoTip text="Every hero a run processed is logged here, newest first; the chip shows which stage did it and when. Use it to confirm a build actually did what you expected." />}
          style={styles.flex1}
        >
          {recentlyEnriched.length === 0 ? (
            <Text style={styles.empty}>Nothing yet — build some heroes and they appear here.</Text>
          ) : (
            <ScrollView style={narrow ? styles.reviewScrollCap : styles.reviewScrollFill} nestedScrollEnabled>
              <View style={styles.reGrid}>
                {recentlyEnriched.map((r, i) => (
                  <Pressable key={`${r.heroId}-${i}`} onPress={() => router.push(`/character/${r.heroId}`)} style={styles.reCard}>
                    <HeroThumb uri={r.imageUrl} width={30} height={40} radius={6} />
                    <View style={styles.reMeta}>
                      <Text style={styles.reName} numberOfLines={1}>{r.name}</Text>
                      <Text style={styles.reSub} numberOfLines={1}>{runTypeLabel(r.runType)}{r.at ? ` · ${relTime(r.at)}` : ''}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          )}
        </Panel>
      </Bento.Row>

      {/* Advanced — automation + history, collapsed by default. */}
      <Pressable onPress={() => setAdvancedOpen((v) => !v)} style={styles.advHead}>
        <Ionicons name={advancedOpen ? 'chevron-down' : 'chevron-forward'} size={16} color={COLORS.navy} />
        <Text style={styles.advHeadText}>Advanced · scheduled crons & run history</Text>
      </Pressable>
      {advancedOpen ? (
        <>
        <Bento.Row narrow={narrow}>
        <Panel
          title="Scheduled crons"
          hint="Background jobs that fill the backlog for you."
          action={<InfoTip text="These jobs run automatically on a schedule. A green dot means active; Stop pauses it (keeping its schedule), Start resumes it. Hover the ? on a job to see what it does." />}
          style={styles.flex1}
        >
          {crons.length === 0 ? (
            <Text style={styles.empty}>No cron jobs scheduled.</Text>
          ) : (
            crons.map((c) => {
              const busyThis = busy === `cron-${c.jobname}`;
              return (
                <View key={c.jobname} style={styles.cronRow}>
                  <View style={[styles.cronDot, { backgroundColor: c.active ? COLORS.green : COLORS.grey }]} />
                  <View style={styles.cronInfo}>
                    <View style={styles.cronNameRow}>
                      <Text style={styles.cronName} numberOfLines={1}>{c.jobname}</Text>
                      <InfoTip text={`${cronHelp(c.jobname)} Schedule: ${c.schedule}.`} size={13} />
                    </View>
                    <Text style={styles.cronMeta} numberOfLines={1}>
                      {humanizeCron(c.schedule)}{c.last_status ? ` · last ${c.last_status}` : ''}
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
        </Bento.Row>

        <Panel
          title="Run history"
          hint={`${runsTotal.toLocaleString()} runs · cron + manual`}
          action={<InfoTip text="Every drain that has run — automatic crons and manual batches alike — newest first. Hover a row to see what it processed." />}
        >
          <RunHistory
            runs={runs}
            total={runsTotal}
            narrow={narrow}
            loading={runsLoading}
            fetching={runsFetching}
            onLoadMore={onLoadMore}
          />
        </Panel>
        </>
      ) : null}
    </Bento>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  flex15: { flex: 1.5 },

  dim: { opacity: 0.4 },

  // The enrichment funnel — one row per stage, bars on a shared scale.
  funnel: { gap: 12 },
  stRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stBadge: {
    width: 20, height: 20, borderRadius: 10, marginTop: 1,
    backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center',
  },
  stBadgeText: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: '#fff' },
  stBody: { flex: 1, minWidth: 0, gap: 5 },
  stHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stName: { fontFamily: 'Nunito_700Bold', fontSize: 13.5, color: COLORS.black, flexShrink: 1 },
  stBottleneck: {
    fontFamily: 'Nunito_700Bold', fontSize: 9.5, color: COLORS.red, letterSpacing: 0.5,
    textTransform: 'uppercase', backgroundColor: COLORS.red + '15', borderRadius: 5,
    paddingHorizontal: 5, paddingVertical: 1, overflow: 'hidden',
  },
  stCount: { marginLeft: 'auto', fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.navy, fontVariant: ['tabular-nums'] },
  stCountDim: { fontFamily: 'Nunito_400Regular', color: COLORS.grey },
  stTrack: { height: 7, borderRadius: 4, backgroundColor: '#efe6d6', overflow: 'hidden' },
  stFill: { height: 7, borderRadius: 4, backgroundColor: COLORS.orange },
  stFillWarn: { backgroundColor: COLORS.red },
  stFoot: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 22 },
  stMeta: { flex: 1, fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: COLORS.grey },
  stStuck: { fontFamily: 'Nunito_700Bold', fontSize: 11.5 },
  stRun: {
    flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#efe6d6',
    borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4,
  },
  stRunText: { fontFamily: 'Nunito_700Bold', fontSize: 11.5, color: COLORS.navy },

  // Primary action row: Build next N + size selector + retry.
  primary: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 16 },
  buildBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.orange,
    borderRadius: 11, paddingHorizontal: 18, paddingVertical: 12,
  },
  buildBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 14.5, color: '#fff' },

  // Advanced (crons + run history) collapsible header.
  advHead: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 6, marginTop: 2 },
  advHeadText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.navy },

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
  cronNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cronName: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.black, flexShrink: 1 },
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

  // Recently enriched
  reGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reCard: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    flexBasis: '31%', flexGrow: 1, minWidth: 190,
    backgroundColor: '#fff', borderRadius: 10, borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.08)', paddingVertical: 7, paddingHorizontal: 9,
  } as object,
  reMeta: { flex: 1, minWidth: 0, gap: 1 },
  reName: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.black },
  reSub: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: COLORS.orange },

  // Needs attention
  // Wide: fill the row-stretched panel so it matches its neighbour's height.
  // Narrow (stacked, no definite parent height): cap instead, or flex:1 collapses to 0.
  reviewScrollFill: { flex: 1, minHeight: 0 } as object,
  reviewScrollCap: { maxHeight: 460 } as object,
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
  cand: { flexDirection: 'row', alignItems: 'stretch', gap: 1 },
  chip: { backgroundColor: COLORS.navy + '12', borderTopLeftRadius: 8, borderBottomLeftRadius: 8, paddingHorizontal: 9, paddingVertical: 5, justifyContent: 'center' },
  chipText: { fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: COLORS.navy },
  chipLink: { backgroundColor: COLORS.navy + '12', borderTopRightRadius: 8, borderBottomRightRadius: 8, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center' },
  loadMore: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#efe6d6', borderRadius: 9, paddingVertical: 9, marginTop: 10,
  },
  loadMoreText: { fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: COLORS.navy },
});
