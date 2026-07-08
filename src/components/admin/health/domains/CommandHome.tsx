// Command home — the read-only glance. Synthesises the catalogue's state from
// existing primitives and deep-links into each domain. No mutations live here
// (actions live on the Build tab); no big gauge (the dark top bar owns it).
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS } from '../../../../constants/colors';
import { Panel } from '../Panel';
import { Bento } from '../Bento';
import { Button, Well } from '../ui';
import { HeroThumb } from '../atoms';
import { CompletenessChart } from '../charts';
import { healthColor, GEMINI_MONTHLY_BUDGET } from '../format';
import type {
  CatalogHealth,
  GapPage,
  HealthSnapshot,
  GeminiSpend,
  CoverageMetric,
  EnrichmentProgress,
} from '../../../../lib/db/catalogHealth';

// One actionable line on the "Needs attention" card — a count, what it means, and
// where tapping takes you (the tab that can clear it).
function AttentionRow({
  icon,
  tint,
  count,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  count: number | string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={s.atRow}>
      <View style={[s.atIcon, { backgroundColor: tint + '1a' }]}>
        <Ionicons name={icon} size={15} color={tint} />
      </View>
      <Text style={s.atCount}>{count}</Text>
      <Text style={s.atLabel} numberOfLines={1}>
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={14} color="rgba(41,60,67,0.3)" />
    </Pressable>
  );
}

export function CommandHome({
  h,
  overall,
  snaps,
  gaps,
  spend,
  progress,
  narrow,
  onJump,
  onOpenSpend,
  onOpenBuild,
  onOpenInbox,
  onSnapshot,
  snapshotting,
  inboxCount,
  onRunDrain,
  draining,
}: {
  h: CatalogHealth;
  overall: number;
  snaps: HealthSnapshot[];
  gaps?: GapPage;
  spend?: GeminiSpend;
  progress?: EnrichmentProgress;
  narrow: boolean;
  onJump: (metric?: CoverageMetric) => void;
  onOpenSpend: () => void;
  onOpenBuild: () => void;
  onOpenInbox: () => void;
  onSnapshot: () => void;
  snapshotting: boolean;
  inboxCount: number;
  onRunDrain: () => void;
  draining: boolean;
}) {
  const router = useRouter();
  const queue = gaps?.heroes.slice(0, 4) ?? [];
  const days = spend?.available ? (spend.days ?? []) : [];
  const spendMax = Math.max(1, ...days.map((d) => d.cost));

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

  return (
    <Bento fill={!narrow}>
      <Bento.Row narrow={narrow} fill>
        {/* Catalogue health — headline % + completeness trend */}
        <Panel
          title="Catalogue health"
          hint={`${h.total.toLocaleString()} heroes tracked`}
          style={s.flex15}
          action={
            <Pressable onPress={() => onJump()} style={[s.mini, narrow && s.miniNarrow]}>
              <Text style={s.miniText}>View coverage</Text>
              <Ionicons name="chevron-forward" size={13} color={COLORS.navy} />
            </Pressable>
          }
        >
          <View style={s.headline}>
            <View>
              <Text style={[s.bigPct, { color: healthColor(overall) }]}>{overall}%</Text>
              <Text style={s.bigCaption}>catalogue complete</Text>
            </View>
            <Pressable
              onPress={onSnapshot}
              disabled={snapshotting}
              style={[s.mini, narrow && s.miniNarrow, snapshotting && s.dim]}
            >
              {snapshotting ? (
                <ActivityIndicator size="small" color={COLORS.navy} />
              ) : (
                <Ionicons name="camera-outline" size={14} color={COLORS.navy} />
              )}
              <Text style={s.miniText}>Snapshot</Text>
            </Pressable>
          </View>
          {snaps.length >= 2 ? (
            <CompletenessChart snaps={snaps} />
          ) : (
            <View style={s.empty}>
              <Ionicons name="trending-up-outline" size={18} color={COLORS.grey} />
              <Text style={s.emptyText}>History begins today — the trend line fills in daily.</Text>
            </View>
          )}
        </Panel>

        {/* Needs attention — the actionable glance; each row deep-links to its tab */}
        <Panel title="Needs attention" hint="What's waiting on a run or on you" style={s.flex1}>
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
          {/* The one primary action on the glance: clear the backlog from here —
              no detour through Build. Hidden when there's nothing to run. */}
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
      </Bento.Row>

      <Bento.Row narrow={narrow} fill>
        {/* Backfill queue preview */}
        <Panel
          title="Backfill queue"
          hint="Weakest metric · most-viewed first"
          style={s.flex15}
          action={
            <Pressable onPress={() => onJump()} style={[s.mini, narrow && s.miniNarrow]}>
              <Text style={s.miniText}>View all</Text>
              <Ionicons name="chevron-forward" size={13} color={COLORS.navy} />
            </Pressable>
          }
        >
          {queue.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="checkmark-done-circle" size={22} color={COLORS.green} />
              <Text style={s.emptyText}>Queue clear.</Text>
            </View>
          ) : (
            <Well>
              {queue.map((hero) => (
                <Pressable
                  key={hero.id}
                  onPress={() => router.push(`/character/${hero.id}`)}
                  style={s.qRow}
                >
                  <HeroThumb uri={hero.image_url} size={30} radius={8} />
                  <View style={s.qInfo}>
                    <Text style={s.qName} numberOfLines={1}>
                      {hero.name}
                    </Text>
                    <Text style={s.qSub} numberOfLines={1}>
                      {hero.publisher ?? '—'}
                      {hero.issue_count != null
                        ? ` · ${hero.issue_count.toLocaleString()} apps`
                        : ''}
                    </Text>
                  </View>
                  <Ionicons name="open-outline" size={15} color="rgba(41,60,67,0.3)" />
                </Pressable>
              ))}
            </Well>
          )}
        </Panel>

        {/* Spend */}
        <Panel title="Spend · 28d" hint="Gemini / GCP" style={s.flex1}>
          <Pressable onPress={onOpenSpend} style={s.spendWrap}>
            {/* Spend against its cap — a number with context, not a bare number. */}
            <Text style={s.spendBig}>
              {spend?.available ? `$${(spend.monthToDate ?? 0).toFixed(0)}` : '—'}
              {spend?.available ? (
                <Text style={s.spendCap}> / ${GEMINI_MONTHLY_BUDGET}</Text>
              ) : null}
            </Text>
            <Text style={s.spendLabel}>month to date</Text>
            {spend?.available ? (
              <View style={s.meter}>
                <View
                  style={[
                    s.meterFill,
                    {
                      width: `${Math.min(100, Math.round(((spend.monthToDate ?? 0) / GEMINI_MONTHLY_BUDGET) * 100))}%`,
                    },
                    overBudget && s.meterOver,
                  ]}
                />
              </View>
            ) : null}
            {days.length > 0 && (
              <View style={s.spendBars}>
                {days.map((d) => (
                  <View key={d.day} style={s.spendCol}>
                    <View
                      style={[s.spendBar, { height: `${Math.round((d.cost / spendMax) * 100)}%` }]}
                    />
                  </View>
                ))}
              </View>
            )}
            <View style={s.spendCta}>
              <Text style={s.miniText}>Open spend</Text>
              <Ionicons name="chevron-forward" size={13} color={COLORS.navy} />
            </View>
          </Pressable>
        </Panel>
      </Bento.Row>
    </Bento>
  );
}

const s = StyleSheet.create({
  flex1: { flex: 1 },
  flex15: { flex: 1.5 },
  headline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  bigPct: { fontFamily: 'Flame-Regular', fontSize: 40, lineHeight: 42 },
  bigCaption: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 0.5,
    color: COLORS.grey,
    textTransform: 'uppercase',
  },
  // Needs-attention rows (list chrome lives in ui/Well now)
  runBtn: { marginTop: 12, alignSelf: 'flex-start' },
  // paddingVertical 8 + 28px icon = 44pt tap target.
  atRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  atIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  atCount: { fontFamily: 'Flame-Regular', fontSize: 18, color: COLORS.black, minWidth: 30 },
  atLabel: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.navy },
  mini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#efe6d6',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  // Mobile: meet the 44pt touch floor (desktop keeps the compact chip).
  miniNarrow: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' },
  miniText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },
  dim: { opacity: 0.4 },
  empty: { alignItems: 'center', gap: 6, paddingVertical: 22 },
  emptyText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: COLORS.grey,
    textAlign: 'center',
    maxWidth: 220,
  },
  // paddingVertical 7 + 30px thumb = 44pt tap target.
  qRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 7 },
  qInfo: { flex: 1, gap: 1 },
  qName: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.black },
  qSub: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: COLORS.grey },
  spendWrap: { gap: 2 },
  spendBig: {
    fontFamily: 'Flame-Regular',
    fontSize: 26,
    color: COLORS.black,
    lineHeight: 28,
    fontVariant: ['tabular-nums'],
  },
  spendCap: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.grey },
  meter: {
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(20,32,40,0.08)',
    marginTop: 8,
    overflow: 'hidden',
  },
  meterFill: { height: '100%', borderRadius: 999, backgroundColor: COLORS.orange },
  meterOver: { backgroundColor: COLORS.red },
  spendLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 0.4,
    color: COLORS.grey,
  },
  spendBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 40, marginTop: 8 },
  spendCol: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  spendBar: { borderRadius: 2, backgroundColor: COLORS.orange, opacity: 0.8 },
  spendCta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 10 },
});
