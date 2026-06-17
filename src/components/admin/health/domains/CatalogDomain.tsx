import { View, Text, Pressable, ActivityIndicator, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS } from '../../../../constants/colors';
import { Panel } from '../Panel';
import { Bento } from '../Bento';
import { HeroThumb } from '../atoms';
import { Donut, BarRow } from '../charts';
import { pct, healthColor, METRICS, WORKLIST_LABEL, type MetricDef } from '../format';
import {
  GAP_PAGE_SIZE,
  type CatalogHealth,
  type CoverageMetric,
  type PublisherCoverage,
  type GapPage,
  type Distributions,
} from '../../../../lib/db/catalogHealth';

// ── Coverage row (tappable → drives the worklist) ─────────────────────────────
function CoverageRow({
  def,
  have,
  total,
  anim,
  active,
  onPress,
  compact,
}: {
  def: MetricDef;
  have: number;
  total: number;
  anim: Animated.Value;
  active: boolean;
  onPress?: () => void;
  compact?: boolean;
}) {
  const p = pct(have, total);
  const gap = total - have;
  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${p}%`] });
  const tappable = !!onPress;
  return (
    <Pressable
      onPress={onPress}
      disabled={!tappable}
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
        [
          styles.covRow,
          compact && styles.covRowNarrow,
          active && styles.covRowActive,
          hovered && tappable && styles.covRowHover,
        ] as object
      }
    >
      <View style={[styles.covDot, { backgroundColor: def.tint }]} />
      <View style={styles.covMain}>
        <View style={styles.covHead}>
          <Text style={styles.covLabel}>
            {def.label}
            {gap === 0 && <Text style={styles.covDone}> ✓</Text>}
          </Text>
          <Text style={[styles.covPctNum, { color: def.tint }]}>{p}%</Text>
        </View>
        <View style={styles.covTrack}>
          <Animated.View style={[styles.covFill, { width, backgroundColor: def.tint }]} />
        </View>
        <View style={styles.covFoot}>
          <Text style={styles.covBlurb}>{def.blurb}</Text>
          <Text style={styles.covGap}>
            {gap > 0 ? `${gap.toLocaleString()} missing` : 'fully covered'}
          </Text>
        </View>
      </View>
      {tappable && (
        <Ionicons
          name="chevron-forward"
          size={16}
          color={active ? def.tint : 'rgba(41,60,67,0.25)'}
          style={{ marginLeft: 4 }}
        />
      )}
    </Pressable>
  );
}

// One publisher sub-table (header + rows) — rendered twice side-by-side on wide.
// Rows are tappable → drill into that publisher's backfill queue.
function PublisherTable({
  rows,
  onPick,
}: {
  rows: PublisherCoverage[];
  onPick: (publisher: string) => void;
}) {
  const cell = (val: number) => (
    <View style={styles.pubCellPct}>
      <View style={[styles.heat, { backgroundColor: healthColor(val) + '22' }]}>
        <Text style={[styles.heatText, { color: healthColor(val) }]}>{val}%</Text>
      </View>
    </View>
  );
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.pubHeadRow}>
        <Text style={[styles.pubCellName, styles.pubHeadText]}>Publisher</Text>
        <Text style={[styles.pubCellNum, styles.pubHeadText]}>Heroes</Text>
        <Text style={[styles.pubCellPct, styles.pubHeadText]}>Portrait</Text>
        <Text style={[styles.pubCellPct, styles.pubHeadText]}>Summary</Text>
        <Text style={[styles.pubCellPct, styles.pubHeadText]}>Stats</Text>
      </View>
      {rows.map((p) => (
        <Pressable
          key={p.publisher}
          onPress={() => onPick(p.publisher)}
          style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
            [styles.pubRow, hovered && styles.pubRowHover] as object
          }
        >
          <Text style={styles.pubCellName} numberOfLines={1}>
            {p.publisher}
          </Text>
          <Text style={styles.pubCellNum}>{p.total.toLocaleString()}</Text>
          {cell(pct(p.portrait, p.total))}
          {cell(pct(p.summary, p.total))}
          {cell(pct(p.stats, p.total))}
        </Pressable>
      ))}
    </View>
  );
}

// Labelled heat pill — the mobile stand-in for a heatmap cell.
function HeatPill({ label, val }: { label: string; val: number }) {
  const c = healthColor(val);
  return (
    <View style={styles.heatPill}>
      <Text style={styles.heatPillLabel}>{label}</Text>
      <View style={[styles.heatPillVal, { backgroundColor: c + '22' }]}>
        <Text style={[styles.heatPillNum, { color: c }]}>{val}%</Text>
      </View>
    </View>
  );
}

// Mobile publisher coverage as a stacked card (replaces the wide heatmap table
// on narrow screens, where the fixed columns would overflow horizontally).
function PublisherCard({
  row,
  onPick,
}: {
  row: PublisherCoverage;
  onPick: (publisher: string) => void;
}) {
  return (
    <Pressable onPress={() => onPick(row.publisher)} style={styles.pubCard}>
      <View style={styles.pubCardHead}>
        <Text style={styles.pubCardName} numberOfLines={1}>
          {row.publisher}
        </Text>
        <Text style={styles.pubCardCount}>{row.total.toLocaleString()} heroes</Text>
        <Ionicons name="chevron-forward" size={15} color="rgba(41,60,67,0.3)" />
      </View>
      <View style={styles.pubCardHeats}>
        <HeatPill label="Portrait" val={pct(row.portrait, row.total)} />
        <HeatPill label="Summary" val={pct(row.summary, row.total)} />
        <HeatPill label="Stats" val={pct(row.stats, row.total)} />
      </View>
    </Pressable>
  );
}

export function CatalogDomain({
  h,
  gaps,
  gapsLoading,
  dist,
  metric,
  setMetric,
  page,
  setPage,
  pubFilter,
  setPubFilter,
  pickPublisher,
  anim,
  narrow,
  sub = 'coverage',
  fill,
}: {
  h?: CatalogHealth;
  gaps?: GapPage;
  gapsLoading: boolean;
  dist?: Distributions;
  metric: CoverageMetric;
  setMetric: (m: CoverageMetric) => void;
  page: number;
  setPage: (fn: (p: number) => number) => void;
  pubFilter: string | null;
  setPubFilter: (p: string | null) => void;
  pickPublisher: (publisher: string) => void;
  anim: Animated.Value;
  narrow: boolean;
  sub?: 'coverage' | 'distributions';
  fill?: boolean;
}) {
  const router = useRouter();

  const align = dist?.alignment;
  const alignTotal = align ? align.good + align.bad + align.neutral + align.unknown : 0;
  const histMax = dist ? Math.max(1, ...dist.power_hist.map((b) => b.n)) : 1;
  const pubMax = h && h.byPublisher.length ? h.byPublisher[0].total : 1;

  return (
    <>
      {/* ── Coverage + Backfill queue ── */}
      {sub === 'coverage' ? (
        <Bento.Row narrow={narrow} fill={fill}>
          {/* Coverage — fixed width; short list, no internal scroll needed. */}
          <Panel
            title="Coverage"
            hint="Sorted by weakest first · tap one to load its queue"
            style={
              { width: narrow ? undefined : 360, flexGrow: 0, flexShrink: 0, gap: 4 } as object
            }
          >
            {!h ? (
              <ActivityIndicator color={COLORS.orange} style={{ marginTop: 20 }} />
            ) : (
              [...METRICS]
                .sort((a, b) => pct(h.metrics[a.key], h.total) - pct(h.metrics[b.key], h.total))
                .map((def) => (
                  <CoverageRow
                    key={def.key}
                    def={def}
                    have={h.metrics[def.key]}
                    total={h.total}
                    anim={anim}
                    compact={narrow}
                    active={def.worklist === metric}
                    onPress={
                      def.worklist
                        ? () => {
                            setMetric(def.worklist!);
                            setPage(() => 0);
                          }
                        : undefined
                    }
                  />
                ))
            )}
          </Panel>

          {/* Backfill queue */}
          <Panel scroll={fill} title="Backfill queue" hint="Most-viewed first" style={{ flex: 1 }}>
            <View style={styles.tabs}>
              {(Object.keys(WORKLIST_LABEL) as CoverageMetric[]).map((m) => {
                const def = METRICS.find((d) => d.worklist === m)!;
                const gap = h ? h.total - h.metrics[def.key] : 0;
                const on = metric === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => {
                      setMetric(m);
                      setPage(() => 0);
                    }}
                    style={[styles.tab, on && { backgroundColor: def.tint }]}
                  >
                    <Text style={[styles.tabText, on && styles.tabTextOn]}>
                      {WORKLIST_LABEL[m]}
                    </Text>
                    {h && (
                      <View style={[styles.tabBadge, on && styles.tabBadgeOn]}>
                        <Text style={[styles.tabBadgeText, on && { color: def.tint }]}>
                          {gap.toLocaleString()}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>

            {pubFilter && (
              <Pressable
                onPress={() => {
                  setPubFilter(null);
                  setPage(() => 0);
                }}
                style={styles.filterChip}
              >
                <Ionicons name="funnel" size={12} color={COLORS.orange} />
                <Text style={styles.filterChipText}>{pubFilter}</Text>
                <Ionicons name="close" size={13} color={COLORS.navy} />
              </Pressable>
            )}

            {gapsLoading || !gaps ? (
              <ActivityIndicator color={COLORS.orange} style={{ marginTop: 24 }} />
            ) : gaps.heroes.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="checkmark-done-circle" size={40} color={COLORS.green} />
                <Text style={styles.emptyText}>Queue clear — every hero has this.</Text>
              </View>
            ) : (
              <>
                {gaps.heroes.map((hero, i) => (
                  <Pressable
                    key={hero.id}
                    onPress={() => router.push(`/character/${hero.id}`)}
                    style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                      [styles.gapRow, hovered && styles.gapRowHover] as object
                    }
                  >
                    <Text style={styles.gapRank}>{page * GAP_PAGE_SIZE + i + 1}</Text>
                    <HeroThumb uri={hero.image_url} width={38} height={48} radius={8} />
                    <View style={styles.gapInfo}>
                      <Text style={styles.gapName} numberOfLines={1}>
                        {hero.name}
                      </Text>
                      <View style={styles.gapSub}>
                        <View style={styles.pubChip}>
                          <Text style={styles.pubChipText} numberOfLines={1}>
                            {hero.publisher ?? '—'}
                          </Text>
                        </View>
                        {hero.issue_count != null && (
                          <Text style={styles.gapApps}>
                            {hero.issue_count.toLocaleString()} apps
                          </Text>
                        )}
                      </View>
                    </View>
                    <Ionicons name="open-outline" size={16} color="rgba(41,60,67,0.3)" />
                  </Pressable>
                ))}
                <View style={styles.pager}>
                  <Pressable
                    disabled={page === 0}
                    onPress={() => setPage((p) => Math.max(0, p - 1))}
                    style={[styles.pageBtn, page === 0 && styles.pageBtnOff]}
                  >
                    <Ionicons name="arrow-back" size={15} color="#fff" />
                  </Pressable>
                  <Text style={styles.pageInfo}>
                    {(page * GAP_PAGE_SIZE + 1).toLocaleString()}–
                    {Math.min((page + 1) * GAP_PAGE_SIZE, gaps.total).toLocaleString()} of{' '}
                    {gaps.total.toLocaleString()}
                  </Text>
                  <Pressable
                    disabled={(page + 1) * GAP_PAGE_SIZE >= gaps.total}
                    onPress={() => setPage((p) => p + 1)}
                    style={[
                      styles.pageBtn,
                      (page + 1) * GAP_PAGE_SIZE >= gaps.total && styles.pageBtnOff,
                    ]}
                  >
                    <Ionicons name="arrow-forward" size={15} color="#fff" />
                  </Pressable>
                </View>
              </>
            )}
          </Panel>
        </Bento.Row>
      ) : null}

      {/* ── Distributions: Alignment + Power + Largest publishers ── */}
      {sub === 'distributions' && dist && h && (
        <Bento.Row narrow={narrow} fill={fill}>
          {/* Alignment */}
          <Panel title="Alignment" hint="Hero vs villain split" style={{ flex: 1 }}>
            {narrow ? (
              <View style={styles.barList}>
                {[
                  { l: 'Heroes', v: align!.good, c: COLORS.green },
                  { l: 'Villains', v: align!.bad, c: COLORS.red },
                  { l: 'Neutral', v: align!.neutral, c: COLORS.yellow },
                  { l: 'Unknown', v: align!.unknown, c: COLORS.grey },
                ].map((s) => (
                  <BarRow key={s.l} label={s.l} value={s.v} max={alignTotal} color={s.c} />
                ))}
              </View>
            ) : (
              <View style={styles.donutWrap}>
                <Donut
                  total={alignTotal}
                  segments={[
                    { value: align!.good, color: COLORS.green, label: 'Heroes' },
                    { value: align!.bad, color: COLORS.red, label: 'Villains' },
                    { value: align!.neutral, color: COLORS.yellow, label: 'Neutral' },
                    { value: align!.unknown, color: COLORS.grey, label: 'Unknown' },
                  ]}
                />
                <View style={styles.legend}>
                  {[
                    { c: COLORS.green, l: 'Heroes', v: align!.good },
                    { c: COLORS.red, l: 'Villains', v: align!.bad },
                    { c: COLORS.yellow, l: 'Neutral', v: align!.neutral },
                    { c: COLORS.grey, l: 'Unknown', v: align!.unknown },
                  ].map((s) => (
                    <View key={s.l} style={styles.legendRow}>
                      <View style={[styles.legendDot, { backgroundColor: s.c }]} />
                      <Text style={styles.legendLabel}>{s.l}</Text>
                      <Text style={styles.legendVal}>{s.v.toLocaleString()}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </Panel>

          {/* Power distribution */}
          <Panel title="Power distribution" hint="Total powerstats (0–600)" style={{ flex: 1 }}>
            {narrow ? (
              <View style={styles.barList}>
                {dist.power_hist.map((b) => (
                  <BarRow
                    key={b.label}
                    label={b.label}
                    value={b.n}
                    max={histMax}
                    color={COLORS.orange}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.histRow}>
                {dist.power_hist.map((b) => (
                  <View key={b.label} style={styles.histCol}>
                    <Text style={styles.histN}>{b.n}</Text>
                    <View style={styles.histTrack}>
                      <View
                        style={[
                          styles.histBar,
                          { height: `${Math.round((b.n / histMax) * 100)}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.histLabel}>{b.label}</Text>
                  </View>
                ))}
              </View>
            )}
          </Panel>

          {/* Largest publishers — redundant with Coverage-by-publisher on mobile */}
          {!narrow && (
            <Panel title="Largest publishers" hint="By hero count" style={{ flex: 1 }}>
              <View style={styles.barList}>
                {h.byPublisher.slice(0, 8).map((p) => (
                  <BarRow
                    key={p.publisher}
                    label={p.publisher}
                    value={p.total}
                    max={pubMax}
                    color={COLORS.blue}
                  />
                ))}
              </View>
            </Panel>
          )}
        </Bento.Row>
      )}

      {/* ── Coverage by publisher heatmap ── */}
      {sub === 'distributions' && h && h.byPublisher.length > 0 && (
        <Bento.Row narrow={narrow} fill={fill}>
          <Panel
            scroll={fill}
            title="Coverage by publisher"
            hint={`Top ${h.byPublisher.length} by catalogue size`}
            style={{ flex: 1 }}
          >
            {narrow ? (
              <View style={styles.pubCards}>
                {h.byPublisher.map((p) => (
                  <PublisherCard key={p.publisher} row={p} onPick={pickPublisher} />
                ))}
              </View>
            ) : (
              <View style={styles.pubSplit}>
                <PublisherTable
                  rows={h.byPublisher.slice(0, Math.ceil(h.byPublisher.length / 2))}
                  onPick={pickPublisher}
                />
                <View style={styles.pubSplitDivider} />
                <PublisherTable
                  rows={h.byPublisher.slice(Math.ceil(h.byPublisher.length / 2))}
                  onPick={pickPublisher}
                />
              </View>
            )}
          </Panel>
        </Bento.Row>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  // Coverage rows
  covRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginHorizontal: -10,
    borderRadius: 14,
  },
  covRowNarrow: { paddingVertical: 8, gap: 10 },
  covRowActive: { backgroundColor: 'rgba(231,115,51,0.06)' },
  covRowHover: { backgroundColor: 'rgba(41,60,67,0.04)' },
  covDot: { width: 10, height: 10, borderRadius: 10, marginTop: 2, alignSelf: 'flex-start' },
  covMain: { flex: 1, gap: 6 },
  covHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  covLabel: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: COLORS.black },
  covDone: { color: COLORS.green },
  covPctNum: { fontFamily: 'Flame-Regular', fontSize: 20 },
  covTrack: { height: 9, borderRadius: 5, backgroundColor: '#efe6d6', overflow: 'hidden' },
  covFill: { height: 9, borderRadius: 5 },
  covFoot: { flexDirection: 'row', justifyContent: 'space-between' },
  covBlurb: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: COLORS.grey },
  covGap: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },

  // Queue
  tabs: { flexDirection: 'row', gap: 8, marginTop: 6, marginBottom: 8, flexWrap: 'wrap' },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#efe6d6',
  },
  tabText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.navy },
  tabTextOn: { color: '#fff' },
  tabBadge: {
    backgroundColor: 'rgba(41,60,67,0.12)',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  tabBadgeOn: { backgroundColor: '#fff' },
  tabBadgeText: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: COLORS.navy },

  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 7,
    marginBottom: 8,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.orange + '18',
    borderWidth: 1,
    borderColor: COLORS.orange + '33',
  },
  filterChipText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },

  empty: { alignItems: 'center', gap: 10, paddingVertical: 36 },
  emptyText: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.grey },

  gapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
    paddingHorizontal: 8,
    marginHorizontal: -8,
    borderRadius: 12,
  },
  gapRowHover: { backgroundColor: 'rgba(41,60,67,0.04)' },
  gapRank: {
    width: 26,
    fontFamily: 'Flame-Regular',
    fontSize: 15,
    color: 'rgba(41,60,67,0.35)',
    textAlign: 'center',
  },
  gapInfo: { flex: 1, gap: 4, minWidth: 0 },
  gapName: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.black },
  gapSub: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pubChip: {
    backgroundColor: '#efe6d6',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    maxWidth: 160,
  },
  pubChipText: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: COLORS.navy },
  gapApps: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: COLORS.grey },

  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1ece2',
  },
  pageBtn: {
    width: 38,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageBtnOff: { opacity: 0.3 },
  pageInfo: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.grey },

  // Charts / distributions
  barList: { gap: 10, marginTop: 8 },
  donutWrap: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 8 },
  legend: { flex: 1, gap: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 10 },
  legendLabel: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.black },
  legendVal: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: COLORS.grey },
  histRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 10 },
  histCol: { flex: 1, alignItems: 'center', gap: 6 },
  histN: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },
  histTrack: {
    width: '100%',
    height: 120,
    backgroundColor: '#f6f0e6',
    borderRadius: 8,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  histBar: { width: '100%', backgroundColor: COLORS.orange, borderRadius: 8 },
  histLabel: { fontFamily: 'Nunito_400Regular', fontSize: 10, color: COLORS.grey },

  // Publisher heatmap
  pubSplit: { flexDirection: 'row', gap: 28 },
  pubSplitDivider: { width: 1, backgroundColor: '#efe6d6' },
  pubCards: { gap: 10, marginTop: 4 },
  pubHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#efe6d6',
    marginTop: 4,
  },
  pubHeadText: {
    color: COLORS.grey,
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  pubCellName: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.black },
  pubCellNum: {
    width: 70,
    textAlign: 'right',
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: COLORS.navy,
  },
  pubCellPct: { width: 92, alignItems: 'flex-end' },
  pubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f6f0e6',
  },
  pubRowHover: { backgroundColor: 'rgba(231,115,51,0.06)' },
  heat: {
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 3,
    minWidth: 46,
    alignItems: 'center',
  },
  heatText: { fontFamily: 'Nunito_700Bold', fontSize: 12 },
  heatPill: { flex: 1, alignItems: 'center', gap: 4 },
  heatPillLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 0.4,
    color: COLORS.grey,
    textTransform: 'uppercase',
  },
  heatPillVal: {
    alignSelf: 'stretch',
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: 'center',
  },
  heatPillNum: { fontFamily: 'Nunito_700Bold', fontSize: 13 },
  pubCard: {
    backgroundColor: '#faf6ee',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.06)',
    padding: 13,
    gap: 11,
  },
  pubCardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pubCardName: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 15, color: COLORS.black },
  pubCardCount: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.grey },
  pubCardHeats: { flexDirection: 'row', gap: 8 },
});
