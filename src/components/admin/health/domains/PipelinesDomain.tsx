// Pipelines ("Build") domain — the control room for every drain that fills the
// catalogue. A thin orchestrator: it owns the sub-tab state and the live-board
// working sets, and composes the focused sub-views — Add (bring characters in) ·
// Enrich (the funnel + "Needs you" review) · Generate (AI powerstats/portraits) ·
// Activity (log · recently built · crons) · Runs (the run-history dashboard).
import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Bento } from '../Bento';
import { Panel } from '../Panel';
import { RunHistory } from '../RunHistory';
import { ActivityLog } from '../ActivityLog';
import { InfoTip } from '../InfoTip';
import { AddHeroesPanel } from '../AddHeroesPanel';
import { SubTabs } from '../SubTabs';
import { StatsBoard } from '../StatsBoard';
import { PortraitBoard } from '../PortraitBoard';
import { Button, PillGroup } from '../ui';
import { PipelineFunnel } from './PipelineFunnel';
import { NeedsYou } from './NeedsYou';
import { RecentlyBuilt } from './RecentlyBuilt';
import { CronList } from './CronList';
import { type Stage } from './pipelineHelpers';
import { getPendingBuildIds } from '../../../../lib/db/build';
import { getPendingStatsIds } from '../../../../lib/db/stats';
import { getPendingPortraitIds } from '../../../../lib/db/portraits';
import {
  GEMINI_MONTHLY_BUDGET,
  STATS_COST_PER_ITEM,
  PORTRAIT_COST_PER_ITEM,
  estCost,
} from '../format';
import { COLORS } from '../../../../constants/colors';
import type { PipelinesData, PipelinesActions, PipelinesControls } from './pipelinesTypes';

const BATCH_OPTIONS = [10, 25, 50];

export function PipelinesDomain({
  data,
  actions,
  controls,
}: {
  data: PipelinesData;
  actions: PipelinesActions;
  controls: PipelinesControls;
}) {
  const {
    h,
    progress,
    ambiguous,
    ambiguousFetching,
    statsPending,
    portraitsPending,
    spend,
    crons,
    runs,
    runsTotal,
    runsLoading,
    runsFetching,
    recentlyEnriched,
    log,
  } = data;
  const {
    onLoadMoreAmbiguous,
    onRunDrain,
    onRetryFailed,
    onToggleAnyCron,
    onRescheduleCron,
    onRunResolve,
    onRunEnrich,
    onResolveQid,
    onMarkUnresolved,
    onBulkAccept,
    onLoadMore,
    clearLog,
    flash,
    onHeroesAdded,
  } = actions;
  const { buildIds, setBuildIds, busy, batchSize, setBatchSize, narrow } = controls;

  // Sub-tabs split the dense Build domain into focused, no-scroll views.
  const [sub, setSub] = useState<'add' | 'enrich' | 'generate' | 'activity' | 'runs'>('add');
  const [statsIds, setStatsIds] = useState<string[] | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [portraitIds, setPortraitIds] = useState<string[] | null>(null);
  const [loadingPortraits, setLoadingPortraits] = useState(false);

  const p = progress ?? {
    heroesTotal: 0,
    comicvineDone: 0,
    comicvineUnmatched: 0,
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

  // Pending (still actionable) at each stage, in funnel order. Both `failed`
  // (real errors) and `comicvineUnmatched` (no ComicVine character by this name)
  // are terminal — they leave the actionable ComicVine backlog.
  const cvUnmatched = p.comicvineUnmatched;
  const cvPending = Math.max(0, p.heroesTotal - p.comicvineDone - failed - cvUnmatched);
  const resolvePending = Math.max(0, p.comicvineDone - p.resolved - p.ambiguous - p.unresolved);
  const appearPending = Math.max(0, p.resolved - p.enriched);
  // The whole enrichment backlog — what "Build" works through, one hero at a time.
  const totalActionable = cvPending + resolvePending + appearPending;

  // A true funnel: every actionable stage shares one denominator (all heroes), so
  // the drop-off between stages is visible. TMDB is a separate unit (titles), apart.
  const stages: Stage[] = [
    {
      key: 'comicvine',
      name: 'ComicVine',
      tip: "Pulls each hero's core data — powers, bio, alter egos, movie list — from ComicVine. This is the gate: every later stage needs it done first.",
      reached: p.comicvineDone,
      total: p.heroesTotal,
      pending: cvPending,
      // Real errors (red) take priority; otherwise show "no ComicVine match"
      // neutrally — these are terminal and need another source, not a retry.
      stuck:
        failed > 0
          ? { label: `${failed} failed`, tone: COLORS.red }
          : cvUnmatched > 0
            ? { label: `${cvUnmatched.toLocaleString()} no ComicVine match`, tone: COLORS.grey }
            : null,
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
          { key: 'runs', label: 'Runs', icon: 'time-outline' },
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
            fill={fill}
            title="Build & status"
            hint={`${p.enriched.toLocaleString()} of ${p.heroesTotal.toLocaleString()} fully enriched · ${totalActionable.toLocaleString()} to go`}
            action={
              <InfoTip text="The enrichment funnel. Each bar is how many heroes have reached that stage, all on the same scale, so you can see where they pile up. 'Build next' works the backlog one hero at a time; 'Run all' on a stage drains just that stage." />
            }
            style={styles.flex15}
          >
            <PipelineFunnel stages={stages} busy={busy} bottleneckKey={bottleneckKey} />

            {/* Primary action: work the whole backlog, one hero at a time, live. */}
            <View style={styles.primary}>
              <Button
                label={`Build next ${Math.min(batchSize, totalActionable || batchSize)}`}
                icon="construct"
                tone="primary"
                disabled={!!buildIds || totalActionable === 0}
                onPress={buildNextPending}
              />
              <PillGroup
                options={BATCH_OPTIONS.map((n) => ({ label: String(n), value: n }))}
                value={batchSize}
                onChange={setBatchSize}
              />
              <InfoTip
                text={`Opens the live Build board for the next ${batchSize} heroes in the backlog — you watch each go ComicVine → Resolve → Appearances, with Pause/Stop. The 10/25/50 sets how many. (Just-added characters get their own Build button up top.)`}
                size={13}
              />
              {failed > 0 ? (
                <Button
                  label={`Retry ${failed} failed`}
                  icon="refresh"
                  tone="ghost"
                  size="sm"
                  loading={busy === 'retry'}
                  disabled={!!busy}
                  onPress={onRetryFailed}
                />
              ) : null}
            </View>
          </Panel>

          <NeedsYou
            ambiguous={ambiguous}
            ambiguousTotal={p.ambiguous}
            ambiguousFetching={ambiguousFetching}
            busy={busy}
            fill={fill}
            onResolveQid={onResolveQid}
            onMarkUnresolved={onMarkUnresolved}
            onBulkAccept={onBulkAccept}
            onLoadMoreAmbiguous={onLoadMoreAmbiguous}
            flash={flash}
          />
        </Bento.Row>
      ) : null}

      {/* Generate — AI powerstats + portraits (paid, Gemini). */}
      {sub === 'generate' ? (
        <Panel
          fill={fill}
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
              <Button
                label={
                  overBudget
                    ? 'Over budget'
                    : `Generate ${Math.min(batchSize, statsPending || batchSize)}`
                }
                icon={overBudget ? 'lock-closed' : 'sparkles'}
                tone="primary"
                loading={loadingStats}
                disabled={overBudget || statsPending === 0 || loadingStats || !!statsIds}
                onPress={generateStats}
              />
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
              <Button
                label={
                  overBudget
                    ? 'Over budget'
                    : `Generate ${Math.min(batchSize, portraitsPending || batchSize)}`
                }
                icon={overBudget ? 'lock-closed' : 'color-palette'}
                tone="primary"
                loading={loadingPortraits}
                disabled={overBudget || portraitsPending === 0 || loadingPortraits || !!portraitIds}
                onPress={generatePortraits}
              />
            </View>
          </View>
        </Panel>
      ) : null}

      {/* Activity — three compact panels (log · recently built · crons) that own
          the full content height. Run history lives on its own "Runs" sub-tab. */}
      {sub === 'activity' ? (
        <Bento.Row narrow={narrow} fill={fill}>
          <ActivityLog log={log} clearLog={clearLog} fill={fill} />
          <RecentlyBuilt recentlyEnriched={recentlyEnriched} fill={fill} />
          <Panel
            fill={fill}
            title="Scheduled crons"
            hint="Background jobs that fill the backlog for you."
            action={
              <InfoTip text="These jobs run automatically on a schedule. A green dot means active; Stop pauses it (keeping its schedule), Start resumes it. Hover the ? on a job to see what it does." />
            }
          >
            <CronList
              crons={crons}
              busy={busy}
              onToggle={onToggleAnyCron}
              onReschedule={onRescheduleCron}
            />
          </Panel>
        </Bento.Row>
      ) : null}

      {/* Runs — the full run-history dashboard gets the whole content area, so its
          wide 9-column table and per-day groups breathe. */}
      {sub === 'runs' ? (
        <Bento.Row narrow={narrow} fill={fill}>
          <Panel
            fill={fill}
            title="Run history"
            hint={`${runsTotal.toLocaleString()} runs · cron + manual`}
            action={
              <InfoTip text="Every drain that has run — automatic crons and manual batches alike — newest first. Hover a row to see what it processed." />
            }
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
  flex15: { flex: 1.5 },
  subFill: { flex: 1, minHeight: 0 } as object,

  // Primary action row: Build next N + size selector + retry.
  primary: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 16 },

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
});
