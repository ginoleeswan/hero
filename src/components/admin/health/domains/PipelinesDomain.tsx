// Pipelines ("Build") domain — the control room for every drain that fills the
// catalogue. Split into focused sub-tabs so each is a compact, near-no-scroll
// view: Add (bring characters in) · Enrich (the funnel + "Needs you" review) ·
// Generate (AI powerstats/portraits) · Activity (log, recently built, crons, runs).
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../../constants/colors';
import { Bento } from '../Bento';
import { Panel } from '../Panel';
import { RunHistory } from '../RunHistory';
import { ActivityLog } from '../ActivityLog';
import { useRouter } from 'expo-router';
import { InfoTip } from '../InfoTip';
import { AddHeroesPanel } from '../AddHeroesPanel';
import { SubTabs } from '../SubTabs';
import { StatsBoard } from '../StatsBoard';
import { PortraitBoard } from '../PortraitBoard';
import { HeroThumb } from '../atoms';
import { getPendingBuildIds } from '../../../../lib/db/build';
import { getPendingStatsIds } from '../../../../lib/db/stats';
import { getPendingPortraitIds } from '../../../../lib/db/portraits';
import { fetchWikidataEntities, type WikidataSummary } from '../../../../lib/api';
import {
  relTime,
  runTypeLabel,
  GEMINI_MONTHLY_BUDGET,
  STATS_COST_PER_ITEM,
  PORTRAIT_COST_PER_ITEM,
  estCost,
  type LogTone,
  LogEntry,
} from '../format';
import type {
  AmbiguousHero,
  CatalogHealth,
  CronJob,
  EnrichmentProgress,
  EnrichmentRun,
  GeminiSpend,
  RecentlyEnriched,
} from '../../../../lib/db/catalogHealth';

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
  if (/^\d+$/.test(min) && /^\d+$/.test(hr))
    return `daily ${hr.padStart(2, '0')}:${min.padStart(2, '0')}`;
  return s;
}

/** Plain-English description of what a scheduled job does, by name. */
function cronHelp(jobname: string): string {
  const n = jobname.toLowerCase();
  if (n.includes('comicvine'))
    return 'Automatically runs the ComicVine drain to keep core hero data (powers, bio, movies) filling in.';
  if (n.includes('tmdb'))
    return 'Automatically runs the TMDB drain to enrich film & TV media (posters, trailers, cast).';
  if (n.includes('wikidata') && n.includes('resolve'))
    return 'Automatically resolves heroes to their Wikidata identity (QID).';
  if (n.includes('wikidata'))
    return 'Automatically pulls cross-media appearances and cast from Wikidata for resolved heroes.';
  if (n.includes('snapshot'))
    return 'Captures a periodic catalogue-health snapshot that feeds the trend charts.';
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
function FunnelStage({
  s,
  n,
  busy,
  bottleneck,
}: {
  s: Stage;
  n: number;
  busy: string | null;
  bottleneck: boolean;
}) {
  const pct = pctOf(s.reached, s.total);
  const running = !!s.run && busy === s.run.busyKey;
  return (
    <View style={styles.stRow}>
      <View style={styles.stBadge}>
        <Text style={styles.stBadgeText}>{n}</Text>
      </View>
      <View style={styles.stBody}>
        <View style={styles.stHead}>
          <Text style={styles.stName} numberOfLines={1}>
            {s.name}
          </Text>
          <InfoTip text={s.tip} size={13} />
          {bottleneck ? <Text style={styles.stBottleneck}>bottleneck</Text> : null}
          <Text style={styles.stCount}>
            {s.reached.toLocaleString()}
            <Text style={styles.stCountDim}> / {s.total.toLocaleString()}</Text>
          </Text>
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
              {s.stuck ? (
                <Text
                  style={[styles.stStuck, { color: s.stuck.tone }]}
                >{`  ·  ${s.stuck.label}`}</Text>
              ) : null}
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

// Cadence presets the cron editor offers (label → 5-field cron expression).
const CADENCE: { label: string; expr: string }[] = [
  { label: '1m', expr: '* * * * *' },
  { label: '2m', expr: '*/2 * * * *' },
  { label: '3m', expr: '*/3 * * * *' },
  { label: '5m', expr: '*/5 * * * *' },
  { label: '15m', expr: '*/15 * * * *' },
  { label: 'hourly', expr: '0 * * * *' },
  { label: 'daily', expr: '5 0 * * *' },
];
const BATCHES = [5, 10, 15, 25, 50];

// One scheduled-cron row: status + Start/Stop, plus an inline editor to change
// its cadence and batch size (admin_reschedule_cron rebuilds the job in place).
function CronRow({
  c,
  busy,
  onToggle,
  onReschedule,
}: {
  c: CronJob;
  busy: string | null;
  onToggle: (jobname: string, enabled: boolean) => void;
  onReschedule: (jobname: string, schedule: string, limit: number | null) => void;
}) {
  const busyThis = busy === `cron-${c.jobname}`;
  const [editing, setEditing] = useState(false);
  const [sched, setSched] = useState(c.schedule);
  const [lim, setLim] = useState<number | null>(c.lim);
  const open = () => {
    setSched(c.schedule);
    setLim(c.lim);
    setEditing(true);
  };
  const save = () => {
    onReschedule(c.jobname, sched, c.lim != null ? lim : null);
    setEditing(false);
  };

  return (
    <View style={styles.cronWrap}>
      <View style={styles.cronRow}>
        <View
          style={[styles.cronDot, { backgroundColor: c.active ? COLORS.green : COLORS.grey }]}
        />
        <View style={styles.cronInfo}>
          <View style={styles.cronNameRow}>
            <Text style={styles.cronName} numberOfLines={1}>
              {c.jobname}
            </Text>
            <InfoTip text={`${cronHelp(c.jobname)} Schedule: ${c.schedule}.`} size={13} />
          </View>
          <Text style={styles.cronMeta} numberOfLines={1}>
            {humanizeCron(c.schedule)}
            {c.lim != null ? ` · ${c.lim}/run` : ''}
            {c.last_status ? ` · last ${c.last_status}` : ''}
          </Text>
        </View>
        <Pressable
          onPress={() => (editing ? setEditing(false) : open())}
          style={[styles.cronEdit, editing && styles.cronEditOn]}
          accessibilityLabel={`Configure ${c.jobname}`}
        >
          <Ionicons name="options-outline" size={15} color={editing ? '#fff' : COLORS.navy} />
        </Pressable>
        <Pressable
          onPress={() => onToggle(c.jobname, !c.active)}
          disabled={!!busy}
          style={[
            styles.cronBtn,
            c.active ? styles.cronBtnStop : styles.cronBtnStart,
            !!busy && styles.dim,
          ]}
        >
          {busyThis ? (
            <ActivityIndicator size="small" color={c.active ? COLORS.navy : '#fff'} />
          ) : (
            <Ionicons
              name={c.active ? 'pause' : 'play'}
              size={12}
              color={c.active ? COLORS.navy : '#fff'}
            />
          )}
          <Text
            style={[
              styles.cronBtnText,
              c.active ? styles.cronBtnTextStop : styles.cronBtnTextStart,
            ]}
          >
            {c.active ? 'Stop' : 'Start'}
          </Text>
        </Pressable>
      </View>

      {editing ? (
        <View style={styles.cronEditor}>
          <Text style={styles.cronEditLabel}>Cadence</Text>
          <View style={styles.cronPills}>
            {CADENCE.map((p) => (
              <Pressable
                key={p.expr}
                onPress={() => setSched(p.expr)}
                style={[styles.cronPill, sched === p.expr && styles.cronPillOn]}
              >
                <Text style={[styles.cronPillText, sched === p.expr && styles.cronPillTextOn]}>
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </View>
          {c.lim != null ? (
            <>
              <Text style={styles.cronEditLabel}>Batch size</Text>
              <View style={styles.cronPills}>
                {BATCHES.map((n) => (
                  <Pressable
                    key={n}
                    onPress={() => setLim(n)}
                    style={[styles.cronPill, lim === n && styles.cronPillOn]}
                  >
                    <Text style={[styles.cronPillText, lim === n && styles.cronPillTextOn]}>
                      {n}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
          <View style={styles.cronEditActions}>
            <Pressable onPress={() => setEditing(false)} style={styles.cronCancel}>
              <Text style={styles.cronCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={save}
              disabled={busyThis}
              style={[styles.cronSave, busyThis && styles.dim]}
            >
              {busyThis ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.cronSaveText}>Save</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : null}
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
  statsPending,
  portraitsPending,
  spend,
  busy,
  batchSize,
  setBatchSize,
  crons,
  onRunDrain,
  onRetryFailed,
  onToggleAnyCron,
  onRescheduleCron,
  onRunResolve,
  onRunEnrich,
  onResolveQid,
  onMarkUnresolved,
  onBulkAccept,
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
  statsPending: number;
  portraitsPending: number;
  spend: GeminiSpend | undefined;
  busy: string | null;
  batchSize: number;
  setBatchSize: (n: number) => void;
  crons: CronJob[];
  onRunDrain: () => void;
  onRetryFailed: () => void;
  onToggleAnyCron: (jobname: string, enabled: boolean) => void;
  onRescheduleCron: (jobname: string, schedule: string, limit: number | null) => void;
  onRunResolve: () => void;
  onRunEnrich: () => void;
  onResolveQid: (id: string, qid: string, name: string) => void;
  onMarkUnresolved: (id: string, name: string) => void;
  onBulkAccept: (heroes: AmbiguousHero[], threshold: number) => void;
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
  // Sub-tabs split the dense Build domain into focused, no-scroll views.
  const [sub, setSub] = useState<'add' | 'enrich' | 'generate' | 'activity'>('add');
  const [statsIds, setStatsIds] = useState<string[] | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [portraitIds, setPortraitIds] = useState<string[] | null>(null);
  const [loadingPortraits, setLoadingPortraits] = useState(false);
  // Wikidata label + description per candidate QID, so the review choice can be
  // made inline instead of opening each candidate in a new tab.
  const [wdInfo, setWdInfo] = useState<Record<string, WikidataSummary>>({});
  // Per-hero manual QID entry, for when the resolver missed the right match entirely.
  const [manualQid, setManualQid] = useState<Record<string, string>>({});
  const BULK_THRESHOLD = 0.9;
  const bulkEligible = ambiguous.filter((hero) => {
    const top = [...hero.candidates].sort((a, b) => b.score - a.score)[0];
    return top && top.score >= BULK_THRESHOLD;
  }).length;
  const p = progress ?? {
    heroesTotal: 0,
    comicvineDone: 0,
    resolved: 0,
    ambiguous: 0,
    unresolved: 0,
    enriched: 0,
    filmTitles: 0,
    tvTitles: 0,
    gameTitles: 0,
    mediaDone: 0,
  };
  const failed = h.cvStatus.failed ?? 0;
  const reviewN = ambiguous.length;

  const buildNextPending = async () => {
    const ids = await getPendingBuildIds(batchSize);
    if (ids.length === 0) {
      flash('Nothing pending to build.', 'info');
      return;
    }
    setBuildIds(ids);
  };

  // Gemini spend gate: block paid generation once month-to-date hits the budget.
  const spendMtd = spend?.available ? (spend.monthToDate ?? 0) : null;
  const overBudget = spendMtd != null && spendMtd >= GEMINI_MONTHLY_BUDGET;

  const generateStats = async () => {
    if (overBudget) {
      flash('Over the monthly Gemini budget — generation paused.', 'info');
      return;
    }
    setLoadingStats(true);
    try {
      const ids = await getPendingStatsIds(batchSize);
      if (ids.length === 0) {
        flash('No heroes need powerstats.', 'info');
        return;
      }
      setStatsIds(ids);
    } finally {
      setLoadingStats(false);
    }
  };

  const generatePortraits = async () => {
    if (overBudget) {
      flash('Over the monthly Gemini budget — generation paused.', 'info');
      return;
    }
    setLoadingPortraits(true);
    try {
      const ids = await getPendingPortraitIds(batchSize);
      if (ids.length === 0) {
        flash('No heroes need a portrait.', 'info');
        return;
      }
      setPortraitIds(ids);
    } finally {
      setLoadingPortraits(false);
    }
  };

  // Open a candidate's Wikidata page in a new tab so you can eyeball the match.
  const openWiki = (qid: string) => {
    if (typeof window !== 'undefined')
      window.open(`https://www.wikidata.org/wiki/${qid}`, '_blank', 'noopener');
  };

  // Pull labels + descriptions for any candidate QIDs we haven't fetched yet, so
  // each candidate reads as e.g. "Batman · fictional superhero in DC Comics".
  useEffect(() => {
    const missing = ambiguous
      .flatMap((hero) => hero.candidates.map((c) => c.qid))
      .filter((qid) => !(qid in wdInfo));
    if (missing.length === 0) return;
    let alive = true;
    fetchWikidataEntities(missing).then((found) => {
      if (alive && Object.keys(found).length > 0) setWdInfo((prev) => ({ ...prev, ...found }));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambiguous]);

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
      key: 'comicvine',
      name: 'ComicVine',
      tip: "Pulls each hero's core data — powers, bio, alter egos, movie list — from ComicVine. This is the gate: every later stage needs it done first.",
      reached: p.comicvineDone,
      total: p.heroesTotal,
      pending: cvPending,
      stuck: failed > 0 ? { label: `${failed} failed`, tone: COLORS.red } : null,
      run: { busyKey: 'drain', onPress: onRunDrain },
    },
    {
      key: 'resolve',
      name: 'Resolve identity',
      tip: 'Matches each hero to its single Wikidata identity (QID) using publisher, first-appearance year, creators and aliases. Uncertain matches go to "Needs you".',
      reached: p.resolved,
      total: p.heroesTotal,
      pending: resolvePending,
      stuck: reviewN > 0 ? { label: `${reviewN} need you`, tone: COLORS.yellow } : null,
      run: { busyKey: 'resolve', onPress: onRunResolve },
    },
    {
      key: 'appearances',
      name: 'Appearances & cast',
      tip: 'For resolved heroes, pulls cross-media appearances (film / TV / game) and who played or voiced them. Feeds the On-Screen shelves and Portrayed-By.',
      reached: p.enriched,
      total: p.heroesTotal,
      pending: appearPending,
      run: { busyKey: 'enrich', onPress: onRunEnrich },
    },
    {
      key: 'tmdb',
      name: 'TMDB media',
      tip: 'Adds posters, backdrops, trailers, cast and where-to-watch to matched film & TV titles. Runs itself on a schedule as Wikidata discovers new titles.',
      reached: p.mediaDone,
      total: Math.max(1, p.filmTitles + p.tvTitles),
      pending: 0,
      auto: true,
    },
  ];
  // Flag the actionable stage holding up the most heroes.
  const maxPending = Math.max(cvPending, resolvePending, appearPending);
  const bottleneckKey =
    maxPending > 0 ? stages.find((s) => !s.auto && s.pending === maxPending)?.key : undefined;

  const fill = !narrow;
  return (
    <Bento fill={fill}>
      <SubTabs
        tabs={[
          { key: 'add', label: 'Add', icon: 'add-circle-outline' },
          { key: 'enrich', label: 'Enrich', icon: 'construct-outline', badge: reviewN },
          {
            key: 'generate',
            label: 'Generate',
            icon: 'sparkles-outline',
            badge: statsPending + portraitsPending,
          },
          { key: 'activity', label: 'Activity', icon: 'pulse-outline' },
        ]}
        active={sub}
        onChange={setSub}
      />

      {/* Add — bring new characters in (scrolls within its area if tall). */}
      {sub === 'add' ? (
        fill ? (
          <ScrollView style={styles.subFill} nestedScrollEnabled>
            <AddHeroesPanel flash={flash} onAdded={onHeroesAdded} onBuild={setBuildIds} />
          </ScrollView>
        ) : (
          <AddHeroesPanel flash={flash} onAdded={onHeroesAdded} onBuild={setBuildIds} />
        )
      ) : null}

      {/* Enrich — the funnel + one primary action, beside what needs you. */}
      {sub === 'enrich' ? (
        <Bento.Row narrow={narrow} fill={fill}>
          <Panel
            scroll={fill}
            title="Build & status"
            hint={`${p.enriched.toLocaleString()} of ${p.heroesTotal.toLocaleString()} fully enriched · ${totalActionable.toLocaleString()} to go`}
            action={
              <InfoTip text="The enrichment funnel. Each bar is how many heroes have reached that stage, all on the same scale, so you can see where they pile up. 'Build next' works the backlog one hero at a time; 'Run all' on a stage drains just that stage." />
            }
            style={styles.flex15}
          >
            <View style={styles.funnel}>
              {stages.map((s, i) => (
                <FunnelStage
                  key={s.key}
                  s={s}
                  n={i + 1}
                  busy={busy}
                  bottleneck={s.key === bottleneckKey}
                />
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
                <Text style={styles.buildBtnText}>
                  Build next {Math.min(batchSize, totalActionable || batchSize)}
                </Text>
              </Pressable>
              <View style={styles.sizeSel}>
                {[10, 25, 50].map((n) => (
                  <Pressable
                    key={n}
                    onPress={() => setBatchSize(n)}
                    style={[styles.sizePill, batchSize === n && styles.sizePillOn]}
                  >
                    <Text style={[styles.sizePillText, batchSize === n && styles.sizePillTextOn]}>
                      {n}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <InfoTip
                text={`Opens the live Build board for the next ${batchSize} heroes in the backlog — you watch each go ComicVine → Resolve → Appearances, with Pause/Stop. The 10/25/50 sets how many. (Just-added characters get their own Build button up top.)`}
                size={13}
              />
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
            hint={
              p.ambiguous > 0 ? `${p.ambiguous.toLocaleString()} to review` : 'Decisions land here'
            }
            action={
              <InfoTip text="Heroes the resolver couldn't confidently match to one Wikidata identity. Each candidate shows its Wikidata name, description and confidence score — tap the right one to lock it in, no need to leave the page. The ↗ still opens Wikidata if you want to dig deeper." />
            }
            style={styles.flex1}
          >
            {ambiguous.length === 0 ? (
              <Text style={styles.empty}>All clear — nothing waiting on you.</Text>
            ) : (
              <ScrollView
                style={styles.reviewScroll}
                nestedScrollEnabled
                showsVerticalScrollIndicator
              >
                {bulkEligible > 0 ? (
                  <Pressable
                    onPress={() => onBulkAccept(ambiguous, BULK_THRESHOLD)}
                    disabled={busy === 'bulk-accept'}
                    style={[styles.bulkBar, busy === 'bulk-accept' && styles.dim]}
                  >
                    {busy === 'bulk-accept' ? (
                      <ActivityIndicator size="small" color={COLORS.green} />
                    ) : (
                      <Ionicons name="checkmark-done" size={15} color={COLORS.green} />
                    )}
                    <Text style={styles.bulkText}>
                      Auto-accept {bulkEligible} confident match{bulkEligible === 1 ? '' : 'es'} (≥{' '}
                      {BULK_THRESHOLD.toFixed(2)})
                    </Text>
                  </Pressable>
                ) : null}
                {ambiguous.map((hero) => {
                  const busyThis = busy === `resolveqid-${hero.id}`;
                  return (
                    <View key={hero.id} style={styles.reviewRow}>
                      <View style={styles.reviewWho}>
                        <HeroThumb uri={hero.imageUrl} width={30} height={40} radius={6} />
                        <View style={styles.reviewMeta}>
                          <Text style={styles.reviewName} numberOfLines={1}>
                            {hero.name}
                          </Text>
                          <Text style={styles.reviewPub} numberOfLines={1}>
                            {hero.publisher ?? '—'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.candidates}>
                        {hero.candidates.map((c) => {
                          const info = wdInfo[c.qid];
                          return (
                            <View key={c.qid} style={styles.cand}>
                              <Pressable
                                onPress={() => onResolveQid(hero.id, c.qid, hero.name)}
                                disabled={!!busy}
                                style={[styles.candMainBtn, !!busy && styles.dim]}
                                accessibilityLabel={`Pick ${info?.label ?? c.qid} for ${hero.name}`}
                              >
                                {info?.image ? (
                                  <HeroThumb uri={info.image} width={30} height={40} radius={6} />
                                ) : (
                                  <View style={styles.candNoImg}>
                                    <Ionicons name="image-outline" size={14} color={COLORS.grey} />
                                  </View>
                                )}
                                <View style={styles.candText}>
                                  <Text style={styles.candLabel} numberOfLines={1}>
                                    {info?.label ?? c.qid}
                                    <Text
                                      style={styles.candScore}
                                    >{`  ·  ${c.score.toFixed(2)}`}</Text>
                                  </Text>
                                  <Text style={styles.candDesc} numberOfLines={2}>
                                    {info
                                      ? info.description || 'no Wikidata description'
                                      : `${c.qid} · loading…`}
                                  </Text>
                                </View>
                                <Ionicons
                                  name={
                                    busyThis ? 'ellipsis-horizontal' : 'checkmark-circle-outline'
                                  }
                                  size={18}
                                  color={COLORS.orange}
                                />
                              </Pressable>
                              <Pressable
                                onPress={() => openWiki(c.qid)}
                                style={styles.chipLink}
                                accessibilityLabel={`Open ${c.qid} on Wikidata to verify`}
                              >
                                <Ionicons name="open-outline" size={14} color={COLORS.navy} />
                              </Pressable>
                            </View>
                          );
                        })}
                      </View>
                      {/* Escape hatch — none of the candidates are right. */}
                      <View style={styles.reviewActions}>
                        <Pressable
                          onPress={() => onMarkUnresolved(hero.id, hero.name)}
                          disabled={!!busy}
                          style={[styles.noneBtn, !!busy && styles.dim]}
                        >
                          <Ionicons name="close-circle-outline" size={14} color={COLORS.grey} />
                          <Text style={styles.noneText}>None of these</Text>
                        </Pressable>
                        <View style={styles.manualBox}>
                          <TextInput
                            value={manualQid[hero.id] ?? ''}
                            onChangeText={(t) =>
                              setManualQid((prev) => ({ ...prev, [hero.id]: t }))
                            }
                            placeholder="paste QID… (Q12345)"
                            placeholderTextColor={COLORS.grey}
                            autoCapitalize="characters"
                            style={[styles.manualInput, { outlineStyle: 'none' }] as object}
                          />
                          <Pressable
                            onPress={() => {
                              const q = (manualQid[hero.id] ?? '').trim().toUpperCase();
                              if (/^Q\d+$/.test(q)) onResolveQid(hero.id, q, hero.name);
                              else flash('Enter a valid QID like Q12345', 'error');
                            }}
                            disabled={!!busy || !(manualQid[hero.id] ?? '').trim()}
                            style={[
                              styles.manualSet,
                              (!!busy || !(manualQid[hero.id] ?? '').trim()) && styles.dim,
                            ]}
                          >
                            <Text style={styles.manualSetText}>Set</Text>
                          </Pressable>
                        </View>
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
      ) : null}

      {/* Generate — AI powerstats + portraits (paid, Gemini). */}
      {sub === 'generate' ? (
        <Panel
          scroll={fill}
          title="AI generation · Gemini"
          hint={
            statsPending > 0
              ? `${statsPending.toLocaleString()} heroes need powerstats`
              : 'Powerstats all generated'
          }
          action={
            <InfoTip text="Generates the six powerstat dials with Gemini for heroes that have ComicVine data but no stats yet. This costs money, so it's gated on your monthly budget. AI Portraits will join here next." />
          }
        >
          <View style={styles.gen}>
            <View style={styles.genItem}>
              <View style={styles.genInfo}>
                <Text style={styles.genName}>Powerstats</Text>
                <Text style={styles.genSub}>
                  {spendMtd != null
                    ? `$${spendMtd.toFixed(0)} / $${GEMINI_MONTHLY_BUDGET} this month`
                    : 'spend data unavailable'}
                  {!overBudget && statsPending > 0
                    ? ` · ~${estCost(Math.min(batchSize, statsPending), STATS_COST_PER_ITEM)}/run`
                    : ''}
                  {overBudget ? ' · over budget' : ''}
                </Text>
              </View>
              <Pressable
                onPress={generateStats}
                disabled={overBudget || statsPending === 0 || loadingStats || !!statsIds}
                style={[
                  styles.genBtn,
                  (overBudget || statsPending === 0 || loadingStats || !!statsIds) && styles.dim,
                ]}
              >
                {loadingStats ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name={overBudget ? 'lock-closed' : 'sparkles'} size={14} color="#fff" />
                )}
                <Text style={styles.genBtnText}>
                  {overBudget
                    ? 'Over budget'
                    : `Generate ${Math.min(batchSize, statsPending || batchSize)}`}
                </Text>
              </Pressable>
            </View>
            <View style={styles.genItem}>
              <View style={styles.genInfo}>
                <Text style={styles.genName}>AI Portraits</Text>
                <Text style={styles.genSub}>
                  {portraitsPending > 0
                    ? `${portraitsPending.toLocaleString()} heroes need a portrait`
                    : 'All portraits generated'}
                  {!overBudget && portraitsPending > 0
                    ? ` · ~${estCost(Math.min(batchSize, portraitsPending), PORTRAIT_COST_PER_ITEM)}/run`
                    : ''}
                  {overBudget ? ' · over budget' : ''}
                </Text>
              </View>
              <Pressable
                onPress={generatePortraits}
                disabled={overBudget || portraitsPending === 0 || loadingPortraits || !!portraitIds}
                style={[
                  styles.genBtn,
                  (overBudget || portraitsPending === 0 || loadingPortraits || !!portraitIds) &&
                    styles.dim,
                ]}
              >
                {loadingPortraits ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons
                    name={overBudget ? 'lock-closed' : 'color-palette'}
                    size={14}
                    color="#fff"
                  />
                )}
                <Text style={styles.genBtnText}>
                  {overBudget
                    ? 'Over budget'
                    : `Generate ${Math.min(batchSize, portraitsPending || batchSize)}`}
                </Text>
              </Pressable>
            </View>
          </View>
        </Panel>
      ) : null}

      {/* Activity — live log, recently built, scheduled crons & run history. */}
      {sub === 'activity' ? (
        <Bento fill={fill}>
          <Bento.Row narrow={narrow} fill={fill}>
            <View style={styles.flex1}>
              <ActivityLog log={log} clearLog={clearLog} />
            </View>
            <Panel
              scroll={fill}
              title="Recently built"
              hint="The exact heroes each run just touched — click one to open it."
              action={
                <InfoTip text="Every hero a run processed is logged here, newest first; the chip shows which stage did it and when. Use it to confirm a build actually did what you expected." />
              }
              style={styles.flex1}
            >
              {recentlyEnriched.length === 0 ? (
                <Text style={styles.empty}>
                  Nothing yet — build some heroes and they appear here.
                </Text>
              ) : (
                <ScrollView style={styles.reviewScroll} nestedScrollEnabled>
                  <View style={styles.reGrid}>
                    {recentlyEnriched.map((r, i) => (
                      <Pressable
                        key={`${r.heroId}-${i}`}
                        onPress={() => router.push(`/character/${r.heroId}`)}
                        style={styles.reCard}
                      >
                        <HeroThumb uri={r.imageUrl} width={30} height={40} radius={6} />
                        <View style={styles.reMeta}>
                          <Text style={styles.reName} numberOfLines={1}>
                            {r.name}
                          </Text>
                          <Text style={styles.reSub} numberOfLines={1}>
                            {runTypeLabel(r.runType)}
                            {r.at ? ` · ${relTime(r.at)}` : ''}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              )}
            </Panel>
          </Bento.Row>
          <Bento.Row narrow={narrow} fill={fill}>
            <Panel
              scroll={fill}
              title="Scheduled crons"
              hint="Background jobs that fill the backlog for you."
              action={
                <InfoTip text="These jobs run automatically on a schedule. A green dot means active; Stop pauses it (keeping its schedule), Start resumes it. Hover the ? on a job to see what it does." />
              }
              style={styles.flex1}
            >
              {crons.length === 0 ? (
                <Text style={styles.empty}>No cron jobs scheduled.</Text>
              ) : (
                crons.map((c) => (
                  <CronRow
                    key={c.jobname}
                    c={c}
                    busy={busy}
                    onToggle={onToggleAnyCron}
                    onReschedule={onRescheduleCron}
                  />
                ))
              )}
            </Panel>
            <Panel
              scroll={fill}
              title="Run history"
              hint={`${runsTotal.toLocaleString()} runs · cron + manual`}
              action={
                <InfoTip text="Every drain that has run — automatic crons and manual batches alike — newest first. Hover a row to see what it processed." />
              }
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
        </Bento>
      ) : null}

      {statsIds ? (
        <StatsBoard
          heroIds={statsIds}
          flash={flash}
          onClose={() => {
            setStatsIds(null);
            onHeroesAdded();
          }}
        />
      ) : null}
      {portraitIds ? (
        <PortraitBoard
          heroIds={portraitIds}
          flash={flash}
          onClose={() => {
            setPortraitIds(null);
            onHeroesAdded();
          }}
        />
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
    width: 20,
    height: 20,
    borderRadius: 10,
    marginTop: 1,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stBadgeText: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: '#fff' },
  stBody: { flex: 1, minWidth: 0, gap: 5 },
  stHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stName: { fontFamily: 'Nunito_700Bold', fontSize: 13.5, color: COLORS.black, flexShrink: 1 },
  stBottleneck: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9.5,
    color: COLORS.red,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    backgroundColor: COLORS.red + '15',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  stCount: {
    marginLeft: 'auto',
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: COLORS.navy,
    fontVariant: ['tabular-nums'],
  },
  stCountDim: { fontFamily: 'Nunito_400Regular', color: COLORS.grey },
  stTrack: { height: 7, borderRadius: 4, backgroundColor: '#efe6d6', overflow: 'hidden' },
  stFill: { height: 7, borderRadius: 4, backgroundColor: COLORS.orange },
  stFillWarn: { backgroundColor: COLORS.red },
  stFoot: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 22 },
  stMeta: { flex: 1, fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: COLORS.grey },
  stStuck: { fontFamily: 'Nunito_700Bold', fontSize: 11.5 },
  stRun: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#efe6d6',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  stRunText: { fontFamily: 'Nunito_700Bold', fontSize: 11.5, color: COLORS.navy },

  // Primary action row: Build next N + size selector + retry.
  primary: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 16 },
  buildBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.orange,
    borderRadius: 11,
    paddingHorizontal: 18,
    paddingVertical: 12,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#efe6d6',
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  ctrlText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },

  // Crons
  cronWrap: { borderBottomWidth: 1, borderBottomColor: 'rgba(41,60,67,0.06)' },
  cronRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  cronEdit: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#efe6d6',
  },
  cronEditOn: { backgroundColor: COLORS.navy },
  cronEditor: { gap: 6, paddingBottom: 10, paddingLeft: 18 },
  cronEditLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10.5,
    letterSpacing: 0.5,
    color: COLORS.grey,
    textTransform: 'uppercase',
  },
  cronPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  cronPill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#efe6d6',
  },
  cronPillOn: { backgroundColor: COLORS.navy },
  cronPillText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },
  cronPillTextOn: { color: '#fff' },
  cronEditActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  cronCancel: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: '#efe6d6',
  },
  cronCancelText: { fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: COLORS.navy },
  cronSave: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: COLORS.orange,
    minWidth: 64,
    alignItems: 'center',
  },
  cronSaveText: { fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: '#fff' },
  cronDot: { width: 8, height: 8, borderRadius: 8 },
  cronInfo: { flex: 1, minWidth: 0, gap: 2 },
  cronNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cronName: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.black, flexShrink: 1 },
  cronMeta: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: COLORS.grey,
    fontVariant: ['tabular-nums'],
  },
  cronBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  cronBtnStart: { backgroundColor: COLORS.green },
  cronBtnStop: { backgroundColor: '#efe6d6' },
  cronBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 11.5 },
  cronBtnTextStart: { color: '#fff' },
  cronBtnTextStop: { color: COLORS.navy },

  // Recently enriched
  reGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    flexBasis: '31%',
    flexGrow: 1,
    minWidth: 190,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.08)',
    paddingVertical: 7,
    paddingHorizontal: 9,
  } as object,
  reMeta: { flex: 1, minWidth: 0, gap: 1 },
  reName: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.black },
  reSub: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: COLORS.orange },

  // Needs attention
  reviewScroll: { maxHeight: 340 } as object,
  subFill: { flex: 1, minHeight: 0 } as object,
  empty: { fontFamily: 'Nunito_400Regular', fontSize: 13.5, color: COLORS.grey },
  reviewRow: {
    flexDirection: 'column',
    gap: 8,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(41,60,67,0.06)',
  },
  reviewWho: { flexDirection: 'row', alignItems: 'center', gap: 9, minWidth: 0 },
  reviewMeta: { flex: 1, minWidth: 0 },
  reviewName: { fontFamily: 'Nunito_700Bold', fontSize: 13.5, color: COLORS.black },
  reviewPub: { fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: COLORS.grey },
  candidates: { gap: 5 },
  cand: { flexDirection: 'row', alignItems: 'stretch', gap: 1 },
  candMainBtn: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.navy + '0d',
    borderTopLeftRadius: 9,
    borderBottomLeftRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  candNoImg: {
    width: 30,
    height: 40,
    borderRadius: 6,
    backgroundColor: COLORS.navy + '0d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  candText: { flex: 1, minWidth: 0, gap: 1 },
  candLabel: { fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: COLORS.navy },
  candScore: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: COLORS.grey,
    fontVariant: ['tabular-nums'],
  },
  candDesc: { fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: COLORS.grey, lineHeight: 15 },
  chipLink: {
    backgroundColor: COLORS.navy + '0d',
    borderTopRightRadius: 9,
    borderBottomRightRadius: 9,
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulkBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.green + '14',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 4,
  },
  bulkText: { fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: COLORS.green },
  reviewActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 7,
    flexWrap: 'wrap',
  },
  noneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  noneText: { fontFamily: 'Nunito_700Bold', fontSize: 11.5, color: COLORS.grey },
  manualBox: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 1,
    flex: 1,
    minWidth: 150,
    justifyContent: 'flex-end',
  },
  manualInput: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: COLORS.navy,
    flex: 1,
    maxWidth: 170,
    backgroundColor: '#f6f0e6',
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  manualSet: {
    backgroundColor: COLORS.navy,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualSetText: { fontFamily: 'Nunito_700Bold', fontSize: 11.5, color: '#fff' },
  loadMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#efe6d6',
    borderRadius: 9,
    paddingVertical: 9,
    marginTop: 10,
  },
  loadMoreText: { fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: COLORS.navy },

  // AI generation (Gemini) panel
  gen: { gap: 4 },
  genItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(41,60,67,0.06)',
  },
  genInfo: { flex: 1, minWidth: 0, gap: 2 },
  genName: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.black },
  genSub: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11.5,
    color: COLORS.grey,
    fontVariant: ['tabular-nums'],
  },
  genBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.orange,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  genBtnGhost: { backgroundColor: '#efe6d6' },
  genBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: '#fff' },
});
