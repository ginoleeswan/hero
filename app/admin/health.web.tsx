import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../src/hooks/useAuth';
import { useProfile } from '../../src/hooks/useProfile';
import { useWebCanvas } from '../../src/hooks/useWebCanvas';
import { LogoLoader } from '../../src/components/ui/LogoLoader';
import { COLORS } from '../../src/constants/colors';
import {
  getCatalogHealth,
  getCoverageGaps,
  GAP_PAGE_SIZE,
  type CoverageMetric,
} from '../../src/lib/db/catalogHealth';

const METRIC_LABEL: Record<CoverageMetric, string> = {
  portrait: 'Portraits',
  summary: 'Summaries',
  firstIssue: 'First issue',
};

const pct = (have: number, total: number) => (total > 0 ? Math.round((have / total) * 100) : 0);

function CoverageBar({
  label,
  have,
  total,
  tint,
}: {
  label: string;
  have: number;
  total: number;
  tint: string;
}) {
  const p = pct(have, total);
  return (
    <View style={styles.barRow}>
      <View style={styles.barHead}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={styles.barNums}>
          {have.toLocaleString()} / {total.toLocaleString()} · {p}%
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${p}%`, backgroundColor: tint }]} />
      </View>
    </View>
  );
}

export default function AdminHealthScreen() {
  useWebCanvas(COLORS.beige);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile(user?.id);

  const [metric, setMetric] = useState<CoverageMetric>('portrait');
  const [page, setPage] = useState(0);

  // Gate: only admins. Anyone else (incl. signed-out) bounces to Explore.
  const gateResolved = !authLoading && !profileLoading;
  const isAdmin = !!profile?.is_admin;
  useEffect(() => {
    if (gateResolved && !isAdmin) router.replace('/explore');
  }, [gateResolved, isAdmin, router]);

  const healthQ = useQuery({
    queryKey: ['catalogHealth'],
    queryFn: getCatalogHealth,
    enabled: gateResolved && isAdmin,
    staleTime: 60_000,
  });

  const gapsQ = useQuery({
    queryKey: ['coverageGaps', metric, page],
    queryFn: () => getCoverageGaps(metric, { page }),
    enabled: gateResolved && isAdmin,
    staleTime: 60_000,
  });

  if (!gateResolved || !isAdmin) return <LogoLoader />;

  const h = healthQ.data;
  const gaps = gapsQ.data;

  return (
    <View style={styles.page}>
      <View style={styles.inner}>
        <Text style={styles.h1}>Catalog Health</Text>
        <Text style={styles.sub}>
          Coverage across {h ? h.total.toLocaleString() : '…'} renderable heroes
        </Text>

        {/* ── Coverage bars ── */}
        <View style={styles.card}>
          {healthQ.isLoading || !h ? (
            <ActivityIndicator color={COLORS.orange} />
          ) : (
            <>
              <CoverageBar label="Portraits (AI)" have={h.metrics.portrait} total={h.total} tint={COLORS.orange} />
              <CoverageBar label="Summary" have={h.metrics.summary} total={h.total} tint={COLORS.blue} />
              <CoverageBar label="First issue" have={h.metrics.firstIssue} total={h.total} tint={COLORS.gold} />
              <CoverageBar label="Source image" have={h.metrics.image} total={h.total} tint={COLORS.green} />
              <CoverageBar label="Powerstats" have={h.metrics.stats} total={h.total} tint={COLORS.green} />
              <View style={styles.statusRow}>
                {Object.entries(h.cvStatus).map(([k, v]) => (
                  <View key={k} style={styles.chip}>
                    <Text style={styles.chipText}>
                      {k}: {v.toLocaleString()}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>

        {/* ── Worklists ── */}
        <Text style={styles.h2}>Gaps — most popular first</Text>
        <View style={styles.tabs}>
          {(Object.keys(METRIC_LABEL) as CoverageMetric[]).map((m) => (
            <Pressable
              key={m}
              onPress={() => {
                setMetric(m);
                setPage(0);
              }}
              style={[styles.tab, metric === m && styles.tabActive]}
            >
              <Text style={[styles.tabText, metric === m && styles.tabTextActive]}>
                {METRIC_LABEL[m]}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.card}>
          {gapsQ.isLoading || !gaps ? (
            <ActivityIndicator color={COLORS.orange} />
          ) : gaps.heroes.length === 0 ? (
            <Text style={styles.empty}>No gaps — every renderable hero has this. 🎉</Text>
          ) : (
            <>
              <Text style={styles.gapCount}>
                {gaps.total.toLocaleString()} missing {METRIC_LABEL[metric].toLowerCase()}
              </Text>
              {gaps.heroes.map((hero) => (
                <Pressable
                  key={hero.id}
                  onPress={() => router.push(`/character/${hero.id}`)}
                  style={styles.gapRow}
                >
                  <Text style={styles.gapName} numberOfLines={1}>
                    {hero.name}
                  </Text>
                  <Text style={styles.gapMeta} numberOfLines={1}>
                    {hero.publisher ?? '—'}
                    {hero.issue_count != null ? `  ·  ${hero.issue_count.toLocaleString()} apps` : ''}
                  </Text>
                </Pressable>
              ))}
              <View style={styles.pager}>
                <Pressable
                  disabled={page === 0}
                  onPress={() => setPage((p) => Math.max(0, p - 1))}
                  style={[styles.pageBtn, page === 0 && styles.pageBtnOff]}
                >
                  <Text style={styles.pageBtnText}>← Prev</Text>
                </Pressable>
                <Text style={styles.pageInfo}>
                  {page * GAP_PAGE_SIZE + 1}–{Math.min((page + 1) * GAP_PAGE_SIZE, gaps.total)} of{' '}
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
                  <Text style={styles.pageBtnText}>Next →</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>

        {/* ── Per-publisher ── */}
        {h && h.byPublisher.length > 0 && (
          <>
            <Text style={styles.h2}>By publisher</Text>
            <View style={styles.card}>
              <View style={[styles.pubRow, styles.pubHead]}>
                <Text style={[styles.pubName, styles.pubHeadText]}>Publisher</Text>
                <Text style={[styles.pubCell, styles.pubHeadText]}>Heroes</Text>
                <Text style={[styles.pubCell, styles.pubHeadText]}>Portrait</Text>
                <Text style={[styles.pubCell, styles.pubHeadText]}>Summary</Text>
              </View>
              {h.byPublisher.map((p) => (
                <View key={p.publisher} style={styles.pubRow}>
                  <Text style={styles.pubName} numberOfLines={1}>
                    {p.publisher}
                  </Text>
                  <Text style={styles.pubCell}>{p.total.toLocaleString()}</Text>
                  <Text style={styles.pubCell}>{pct(p.portrait, p.total)}%</Text>
                  <Text style={styles.pubCell}>{pct(p.summary, p.total)}%</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.beige, minHeight: '100%' as unknown as number },
  inner: { width: '100%', maxWidth: 880, alignSelf: 'center', padding: 20, gap: 8 },
  h1: { fontFamily: 'Flame-Regular', fontSize: 34, color: COLORS.black, marginTop: 8 },
  sub: { fontFamily: 'Nunito_400Regular', fontSize: 15, color: COLORS.grey, marginBottom: 12 },
  h2: {
    fontFamily: 'Flame-Regular',
    fontSize: 22,
    color: COLORS.black,
    marginTop: 24,
    marginBottom: 10,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  barRow: { gap: 6 },
  barHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  barLabel: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.black },
  barNums: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: COLORS.grey },
  track: { height: 8, borderRadius: 4, backgroundColor: '#ece3d5', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { backgroundColor: '#f1ece2', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#ece3d5',
  },
  tabActive: { backgroundColor: COLORS.orange },
  tabText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.navy },
  tabTextActive: { color: '#fff' },
  empty: { fontFamily: 'Nunito_400Regular', fontSize: 14, color: COLORS.grey },
  gapCount: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.orange, marginBottom: 4 },
  gapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1ece2',
    gap: 12,
  },
  gapName: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.black, flexShrink: 1 },
  gapMeta: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: COLORS.grey, flexShrink: 0 },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  pageBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: COLORS.navy },
  pageBtnOff: { opacity: 0.35 },
  pageBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: '#fff' },
  pageInfo: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: COLORS.grey },
  pubRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  pubHead: { borderBottomWidth: 1, borderBottomColor: '#ece3d5', paddingBottom: 9 },
  pubHeadText: { color: COLORS.grey, fontFamily: 'Nunito_700Bold', fontSize: 12 },
  pubName: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.black },
  pubCell: { width: 72, textAlign: 'right', fontFamily: 'Nunito_400Regular', fontSize: 13, color: COLORS.navy },
});
