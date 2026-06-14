// Pipelines domain — the control room for every drain that fills the catalogue.
// Compact 2-D dashboard: pipeline cards (with ring gauges) sit beside the live
// activity log so running a drain and seeing its result need no scrolling; crons
// and the review queue pair below; full run history underneath.
import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../../constants/colors';
import { Bento } from '../Bento';
import { Panel } from '../Panel';
import { RunHistory } from '../RunHistory';
import { ActivityLog } from '../ActivityLog';
import { useRouter } from 'expo-router';
import { InfoTip } from '../InfoTip';
import { AddHeroesPanel } from '../AddHeroesPanel';
import { BuildBoard } from '../BuildBoard';
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

// Progress ring (arc only). The centre is filled by the run control in the node.
function Ring({ percent, size, stroke = 6 }: { percent: number; size: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, percent / 100));
  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke="#efe6d6" strokeWidth={stroke} fill="none" />
      <Circle
        cx={size / 2} cy={size / 2} r={r} stroke={COLORS.orange} strokeWidth={stroke} fill="none"
        strokeDasharray={`${frac * c} ${c}`} strokeLinecap="round"
      />
    </Svg>
  );
}

const RING = 72;

// One node of the horizontal assembly line: a progress ring with the run button
// inside it, a step-number badge, and the label below.
function PipelineNode({ p, step, busy }: { p: Pipeline; step: number; busy: string | null }) {
  const percent = pctOf(p.have, p.total);
  const running = p.run && busy === p.run.busyKey;
  const disabled = !!busy;
  return (
    <View style={styles.node}>
      <View style={styles.ringWrap}>
        <Ring percent={percent} size={RING} />
        <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>{step}</Text></View>
        {p.run ? (
          <Pressable
            onPress={p.run.onPress}
            disabled={disabled}
            style={[styles.ringCenter, styles.ringCenterRun, disabled && styles.dim]}
            accessibilityLabel={`${p.run.label} ${p.name}`}
          >
            {running ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="play" size={20} color="#fff" />
            )}
          </Pressable>
        ) : (
          <View style={[styles.ringCenter, styles.ringCenterAuto]}>
            <Ionicons name="time-outline" size={18} color={COLORS.grey} />
          </View>
        )}
      </View>
      <View style={styles.nodeNameRow}>
        <Text style={styles.nodeName} numberOfLines={1}>{p.name}</Text>
        <InfoTip text={p.tip} size={13} />
      </View>
      <Text style={styles.nodePct}>
        {p.run ? `${percent}%` : p.note ?? 'auto'}
        <Text style={styles.nodeCount}>  ·  {p.have.toLocaleString()}/{p.total.toLocaleString()}</Text>
      </Text>
    </View>
  );
}

interface Pipeline {
  key: string;
  name: string;
  blurb: string;
  tip: string;
  dependsOn?: string;
  have: number;
  total: number;
  note?: string;
  run?: { label: string; busyKey: string; onPress: () => void };
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
  const [buildIds, setBuildIds] = useState<string[] | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const p = progress ?? {
    heroesTotal: 0, comicvineDone: 0, resolved: 0, ambiguous: 0, unresolved: 0,
    enriched: 0, filmTitles: 0, tvTitles: 0, gameTitles: 0, mediaDone: 0,
  };
  const failed = h.cvStatus.failed ?? 0;

  const buildNextPending = async () => {
    const ids = await getPendingBuildIds(25);
    if (ids.length === 0) { flash('Nothing pending to build.', 'info'); return; }
    setBuildIds(ids);
  };

  // Assembly line: each step feeds the next, so they render top-to-bottom in order.
  const pipelines: Pipeline[] = [
    {
      key: 'comicvine', name: 'ComicVine', blurb: 'Core hero data — powers, bio, movies',
      tip: `Pulls each hero's core data — powers, bio, alter egos, movie list — from ComicVine. "Run ${batchSize}" processes the next ${batchSize} heroes that still need it. The ring shows how many of all heroes are done.`,
      have: p.comicvineDone, total: p.heroesTotal,
      run: { label: `Run ${batchSize}`, busyKey: 'drain', onPress: onRunDrain },
    },
    {
      key: 'wd-resolve', name: 'Wikidata · resolve', blurb: 'Match each hero to its Wikidata identity',
      tip: 'Matches each hero to its single correct Wikidata identity (QID) using publisher, first-appearance year, creators and aliases. Required before appearances can be pulled. Uncertain matches go to "Needs attention".',
      have: p.resolved, total: p.heroesTotal,
      run: { label: 'Resolve', busyKey: 'resolve', onPress: onRunResolve },
    },
    {
      key: 'wd-enrich', name: 'Wikidata · appearances', blurb: `Cross-media + cast (${p.tvTitles}+${p.gameTitles} tv/game titles)`,
      tip: 'For resolved heroes, pulls cross-media appearances (film / TV / game) and who played or voiced them. Feeds the On-Screen shelves and the Portrayed-By section. Ring = enriched ÷ resolved heroes.',
      dependsOn: 'needs resolved heroes (step 2)',
      have: p.enriched, total: p.resolved,
      run: { label: 'Enrich', busyKey: 'enrich', onPress: onRunEnrich },
    },
    {
      key: 'tmdb', name: 'TMDB · media', blurb: `${p.mediaDone.toLocaleString()} of ${(p.filmTitles + p.tvTitles).toLocaleString()} film/TV enriched`,
      tip: 'Adds rich media to matched film & TV titles — posters, backdrops, trailers, cast and where-to-watch. Runs automatically on a schedule; it keeps working as Wikidata discovers new titles.',
      dependsOn: 'auto-fills titles found in step 3',
      have: p.mediaDone, total: p.filmTitles + p.tvTitles, note: 'cron',
    },
  ];

  return (
    <Bento>
      {/* 1 · Add characters — name / team / series, multi-select, build live. */}
      <AddHeroesPanel flash={flash} onAdded={onHeroesAdded} onBuild={setBuildIds} />

      {/* 2 · Build & status — backlog runs + live build, beside what needs you. */}
      <Bento.Row narrow={narrow}>
        <Panel
          title="2 · Build & status"
          hint="Each ring is a stage's coverage. Press a ring to run that stage over the backlog, or build the next batch live."
          action={<InfoTip text="Each ring is a stage and how complete it is. Press a ring to run that stage across the whole backlog (a batch drain). 'Build next 25' opens the live board for the next pending heroes. Stages depend on the one before them." />}
          style={styles.flex15}
        >
          <View style={styles.flow}>
            {pipelines.map((pl, i) => (
              <View key={pl.key} style={styles.flowItem}>
                <PipelineNode p={pl} step={i + 1} busy={busy} />
                {i < pipelines.length - 1 ? (
                  <Ionicons name="chevron-forward" size={18} color="rgba(41,60,67,0.28)" style={styles.flowArrow as object} />
                ) : null}
              </View>
            ))}
          </View>
          {/* ComicVine batch + retry, kept compact under the grid. */}
          <View style={styles.cvControls}>
            <Text style={styles.cvControlsLabel}>ComicVine batch</Text>
            <InfoTip text="How many heroes one ComicVine run processes. Larger = more per click, but each run takes longer and uses more API budget." size={13} />
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
            <InfoTip text="Re-queues heroes whose last ComicVine fetch errored, so the next run tries them again." size={13} />
          </View>
          {/* Live, watched build of the next pending heroes (the global backlog). */}
          <View style={styles.buildRow}>
            <Pressable onPress={buildNextPending} disabled={!!buildIds} style={[styles.buildBtn, !!buildIds && styles.dim]}>
              <Ionicons name="construct" size={14} color="#fff" />
              <Text style={styles.buildBtnText}>Build next 25 pending</Text>
            </Pressable>
            <InfoTip text="Opens the live Build board for the next 25 heroes that still need a stage — you watch them go through ComicVine → Resolve → Appearances, with Pause/Stop. (Your just-added characters get their own Build button up in Add.)" size={13} />
          </View>
        </Panel>

        <Panel
          title="Needs you"
          hint={ambiguous.length > 0 ? `${ambiguous.length} to review` : 'Decisions land here'}
          action={<InfoTip text="Heroes the resolver couldn't confidently match to one Wikidata identity. Each chip is a candidate (QID · confidence score) — click the correct one to lock it in and let it be enriched." />}
          style={styles.flex1}
        >
          {ambiguous.length === 0 ? (
            <Text style={styles.empty}>All clear — nothing waiting on you.</Text>
          ) : (
            <ScrollView style={styles.reviewScroll} nestedScrollEnabled showsVerticalScrollIndicator>
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
            })}
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
            <ScrollView style={styles.reviewScroll} nestedScrollEnabled>
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

        <Panel
          title="Run history"
          hint={`${runsTotal.toLocaleString()} runs · cron + manual`}
          action={<InfoTip text="Every drain that has run — automatic crons and manual batches alike — newest first. Hover a row to see what it processed." />}
          style={styles.flex1}
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
      </Bento.Row>
      ) : null}

      {buildIds ? (
        <BuildBoard heroIds={buildIds} flash={flash} onClose={() => setBuildIds(null)} />
      ) : null}
    </Bento>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  flex15: { flex: 1.5 },

  // Pipeline assembly-line flow (horizontal nodes + arrows)
  flow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between' },
  flowItem: { flexDirection: 'row', alignItems: 'center', flexGrow: 1 },
  flowArrow: { marginHorizontal: 4 },
  node: { alignItems: 'center', gap: 7, paddingVertical: 6, minWidth: 104, flex: 1 },
  ringWrap: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  ringCenter: {
    position: 'absolute', width: RING - 22, height: RING - 22, borderRadius: (RING - 22) / 2,
    alignItems: 'center', justifyContent: 'center',
  },
  ringCenterRun: { backgroundColor: COLORS.orange, cursor: 'pointer' } as object,
  ringCenterAuto: { backgroundColor: '#f1ece2' },
  stepBadge: {
    position: 'absolute', top: -2, left: -2, width: 20, height: 20, borderRadius: 10,
    backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fffdf8',
  },
  stepBadgeText: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: '#fff' },
  nodeNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 150 },
  nodeName: { fontFamily: 'Flame-Regular', fontSize: 12.5, color: COLORS.black, textAlign: 'center', flexShrink: 1 },
  nodePct: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: COLORS.orange },
  nodeCount: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: COLORS.grey },
  dim: { opacity: 0.4 },

  // "Build next N" — opens the live board for the global backlog.
  buildRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  buildBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: COLORS.orange,
    borderRadius: 10, paddingHorizontal: 15, paddingVertical: 10,
  },
  buildBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 13.5, color: '#fff' },

  // Advanced (crons + run history) collapsible header.
  advHead: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 6, marginTop: 2 },
  advHeadText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.navy },

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
  reviewScroll: { maxHeight: 320 } as object,
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
