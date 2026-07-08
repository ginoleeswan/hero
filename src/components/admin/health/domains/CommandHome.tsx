// Command home — the situational-awareness bridge. Three tiers: a live pulse
// band (who's on the app now + today's audience + system status), an instrument
// cluster (one vital per lane, each deep-linking), and the ops floor (a live
// cross-domain activity feed beside the "needs you" board + traffic pulse).
// Read-only glance with the one primary action (Run enrichment) inline.
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../../constants/colors';
import { Panel } from '../Panel';
import { Bento } from '../Bento';
import { Button, Well } from '../ui';
import { AttentionRow } from './overview/AttentionRow';
import { LivePulse } from './overview/LivePulse';
import { VitalsCluster, type Vital } from './overview/VitalsCluster';
import { ActivityFeed } from './overview/ActivityFeed';
import { Sparkline } from './overview/Sparkline';
import { mergeActivityFeed } from './overview/feed';
import { healthColor, GEMINI_MONTHLY_BUDGET } from '../format';
import type {
  CatalogHealth,
  GeminiSpend,
  CoverageMetric,
  EnrichmentProgress,
  EnrichmentRun,
} from '../../../../lib/db/catalogHealth';
import type { TrafficOverview } from '../../../../lib/db/traffic';
import type { CommunityOverview } from '../../../../lib/db/community';

export function CommandHome({
  h,
  overall,
  spend,
  progress,
  traffic,
  community,
  runs,
  narrow,
  onJump,
  onOpenSpend,
  onOpenBuild,
  onOpenInbox,
  onOpenAudience,
  onSnapshot,
  snapshotting,
  inboxCount,
  onRunDrain,
  draining,
}: {
  h: CatalogHealth;
  overall: number;
  spend?: GeminiSpend;
  progress?: EnrichmentProgress;
  traffic: TrafficOverview | null;
  community: CommunityOverview | null;
  runs: EnrichmentRun[];
  narrow: boolean;
  onJump: (metric?: CoverageMetric) => void;
  onOpenSpend: () => void;
  onOpenBuild: () => void;
  onOpenInbox: () => void;
  onOpenAudience: () => void;
  onSnapshot: () => void;
  snapshotting: boolean;
  inboxCount: number;
  onRunDrain: () => void;
  draining: boolean;
}) {
  // What needs a human or a run, derived from the enrichment funnel.
  const p = progress;
  const failed = h.cvStatus.failed ?? 0;
  const needsYou = p?.ambiguous ?? 0;
  const toEnrich = p
    ? Math.max(0, p.heroesTotal - p.comicvineDone - failed) +
      Math.max(0, p.comicvineDone - p.resolved - p.ambiguous - p.unresolved) +
      Math.max(0, p.resolved - p.enriched)
    : 0;
  const spendMtd = spend?.available ? (spend.monthToDate ?? 0) : null;
  const overBudget = spendMtd != null && spendMtd >= GEMINI_MONTHLY_BUDGET;
  const allClear =
    needsYou === 0 && failed === 0 && toEnrich === 0 && !overBudget && inboxCount === 0;
  const attentionCount = inboxCount + failed + needsYou + (overBudget ? 1 : 0);

  const todayViews = traffic?.today.views ?? 0;
  const yViews = traffic?.yesterday.views ?? 0;
  const viewsDelta = yViews > 0 ? Math.round(((todayViews - yViews) / yViews) * 100) : null;

  // The instrument cluster — one vital per lane.
  const vitals: Vital[] = [
    {
      key: 'visitors',
      label: 'Visitors today',
      icon: 'people-outline',
      tint: COLORS.blue,
      value: (traffic?.today.visitors ?? 0).toLocaleString(),
      delta:
        viewsDelta != null ? { text: `${Math.abs(viewsDelta)}%`, up: viewsDelta >= 0 } : undefined,
      onPress: onOpenAudience,
    },
    {
      key: 'catalog',
      label: 'Catalog',
      icon: 'albums-outline',
      tint: healthColor(overall),
      value: `${overall}%`,
      onPress: () => onJump(),
    },
    {
      key: 'backlog',
      label: 'Backlog',
      icon: 'construct-outline',
      tint: toEnrich > 0 ? COLORS.orange : COLORS.green,
      value: toEnrich.toLocaleString(),
      onPress: onOpenBuild,
    },
    {
      key: 'inbox',
      label: 'Inbox',
      icon: 'file-tray-full-outline',
      tint: inboxCount > 0 ? COLORS.yellow : COLORS.green,
      value: inboxCount.toLocaleString(),
      onPress: onOpenInbox,
    },
    {
      key: 'spend',
      label: 'AI spend',
      icon: 'cash-outline',
      tint: overBudget ? COLORS.red : COLORS.navy,
      value: spend?.available ? `$${(spend.monthToDate ?? 0).toFixed(0)}` : '—',
      onPress: onOpenSpend,
    },
    {
      key: 'members',
      label: 'Members',
      icon: 'ribbon-outline',
      tint: COLORS.navy,
      value: (community?.totals.members ?? 0).toLocaleString(),
      onPress: onOpenAudience,
    },
  ];

  const feed = mergeActivityFeed({
    runs,
    live: traffic?.live,
    community: community?.recent,
  });
  const series = traffic?.series ?? [];

  return (
    <Bento fill={!narrow}>
      <LivePulse
        activeNow={traffic?.activeNow ?? 0}
        onlineMembers={community?.online.onlineNow ?? 0}
        todayVisitors={traffic?.today.visitors ?? 0}
        todayViews={todayViews}
        yesterdayViews={yViews}
        attention={attentionCount}
        onSnapshot={onSnapshot}
        snapshotting={snapshotting}
        narrow={narrow}
      />

      <VitalsCluster vitals={vitals} />

      <Bento.Row narrow={narrow} fill>
        {/* The ops floor — a live cross-domain stream. */}
        <Panel
          title="Live activity"
          hint="Runs · views · engagement, as it happens"
          style={s.flex13}
          fill={!narrow}
          scroll={false}
        >
          <ActivityFeed items={feed} narrow={narrow} />
        </Panel>

        {/* Right column: needs-you board (content-sized so its primary action is
            never clipped) + traffic pulse (absorbs the remaining height). */}
        <View style={[s.rightCol, !narrow && s.rightColFill]}>
          <Panel title="Needs attention">
            {allClear ? (
              <View style={s.empty}>
                <Ionicons name="checkmark-done-circle" size={22} color={COLORS.green} />
                <Text style={s.emptyText}>All clear — nothing needs you right now.</Text>
              </View>
            ) : (
              <Well>
                {inboxCount > 0 ? (
                  <AttentionRow
                    icon="mail-unread-outline"
                    tint={COLORS.yellow}
                    count={inboxCount.toLocaleString()}
                    label="in the inbox"
                    onPress={onOpenInbox}
                  />
                ) : null}
                {needsYou > 0 ? (
                  <AttentionRow
                    icon="git-pull-request-outline"
                    tint={COLORS.yellow}
                    count={needsYou.toLocaleString()}
                    label="need your review"
                    onPress={onOpenBuild}
                  />
                ) : null}
                {failed > 0 ? (
                  <AttentionRow
                    icon="close-circle-outline"
                    tint={COLORS.red}
                    count={failed.toLocaleString()}
                    label="failed to enrich"
                    onPress={onOpenBuild}
                  />
                ) : null}
                {toEnrich > 0 ? (
                  <AttentionRow
                    icon="construct-outline"
                    tint={COLORS.orange}
                    count={toEnrich.toLocaleString()}
                    label="waiting to enrich"
                    onPress={onOpenBuild}
                  />
                ) : null}
                {overBudget ? (
                  <AttentionRow
                    icon="lock-closed-outline"
                    tint={COLORS.red}
                    count="!"
                    label="over monthly AI budget"
                    onPress={onOpenSpend}
                  />
                ) : null}
              </Well>
            )}
            {!allClear && toEnrich > 0 && !overBudget ? (
              <Button
                tone="primary"
                icon="play"
                label="Run enrichment now"
                onPress={onRunDrain}
                loading={draining}
                style={s.runBtn}
              />
            ) : null}
          </Panel>

          <Panel
            title="Traffic pulse"
            hint={traffic ? `Last ${traffic.rangeDays} days` : undefined}
            style={s.stack}
            fill={!narrow}
            scroll={false}
          >
            {series.length >= 2 ? (
              <View style={[s.pulseWrap, !narrow && s.pulseWrapFill]}>
                {/* Headline stats lead; the trend fills the rest of the cell. */}
                <View style={s.pulseStats}>
                  <PulseStat value={`${traffic?.activeNow ?? 0}`} label="active now" live />
                  <PulseStat value={(traffic?.today.visitors ?? 0).toLocaleString()} label="today" />
                  <PulseStat
                    value={(traffic?.totals.visitors ?? 0).toLocaleString()}
                    label={`${traffic?.rangeDays ?? 0}d total`}
                  />
                </View>
                <View style={!narrow ? s.sparkFill : s.sparkFixed}>
                  <Sparkline
                    values={series.map((pt) => pt.visitors)}
                    color={COLORS.blue}
                    grow={!narrow}
                    height={narrow ? 88 : 120}
                  />
                </View>
              </View>
            ) : (
              <View style={s.empty}>
                <Ionicons name="pulse-outline" size={18} color={COLORS.grey} />
                <Text style={s.emptyText}>Traffic history fills in as visitors arrive.</Text>
              </View>
            )}
          </Panel>
        </View>
      </Bento.Row>
    </Bento>
  );
}

function PulseStat({ value, label, live }: { value: string; label: string; live?: boolean }) {
  return (
    <View style={s.pulseStat}>
      <View style={s.pulseValRow}>
        {live ? <View style={s.liveDot} /> : null}
        <Text style={s.pulseVal}>{value}</Text>
      </View>
      <Text style={s.pulseLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  flex13: { flex: 1.3 },
  // Column of two stacked panels. Only flex on desktop (fill layout divides the
  // viewport); on narrow it's content-sized so panels never spill (see the
  // Panel flex-spill note).
  rightCol: { gap: 10 },
  rightColFill: { flex: 1, minHeight: 0 },
  stack: { flex: 1 },
  runBtn: { marginTop: 12, alignSelf: 'flex-start' },
  empty: { alignItems: 'center', gap: 6, paddingVertical: 22 },
  emptyText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: COLORS.grey,
    textAlign: 'center',
    maxWidth: 220,
  },
  // Traffic pulse: headline stats up top, trend fills the remaining cell height.
  pulseWrap: { gap: 10 },
  pulseWrapFill: { flex: 1, minHeight: 0 },
  sparkFill: { flex: 1, minHeight: 48 },
  sparkFixed: { height: 88 },
  pulseStats: { flexDirection: 'row', gap: 20 },
  pulseStat: { gap: 1 },
  pulseValRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDot: { width: 7, height: 7, borderRadius: 999, backgroundColor: COLORS.green },
  pulseVal: {
    fontFamily: 'Flame-Regular',
    fontSize: 20,
    color: COLORS.black,
    lineHeight: 22,
    fontVariant: ['tabular-nums'],
  },
  pulseLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: COLORS.grey,
  },
});
