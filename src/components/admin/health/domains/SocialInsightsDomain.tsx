// Publish › Insights — what the posting loop actually earned. Reads the
// social_post_results snapshots (manual logs + the nightly reddit/instagram
// auto-pull) and answers three questions: how much attention overall, which
// FORMAT wins (the rebiasing signal), and which individual posts to make more
// of. Single-measure magnitude displays use one hue (gold) with direct value
// labels; platform identity rides on text chips, never color alone.
import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Panel } from '../Panel';
import { EmptyState } from '../ui';
import { SkRows } from '../skeletons';
import { COLORS, PAPER_TEXT } from '../../../../constants/colors';
import {
  listSocialPosts,
  listPostResults,
  listChannelStats,
  importChannelStats,
  importTiktokContentResults,
  syncInstagram,
  syncTiktok,
  type SocialPost,
  type SocialPostResult,
} from '../../../../lib/db/socialPosts';
import { parseTiktokCsv } from '../../../../lib/social/tiktokCsv';

const GOLD = '#e0a83e';

const fmt = (n: number) =>
  n >= 1000000
    ? `${(n / 1000000).toFixed(1)}m`
    : n >= 10000
      ? `${(n / 1000).toFixed(0)}k`
      : n >= 1000
        ? `${(n / 1000).toFixed(1)}k`
        : String(n);

// Snapshots stack over time — the latest per (post, platform) is the truth.
function latestPerPostPlatform(results: SocialPostResult[]): SocialPostResult[] {
  const seen = new Set<string>();
  const latest: SocialPostResult[] = [];
  // listPostResults is ordered recorded_at desc, so first hit per key wins.
  for (const r of results) {
    const key = `${r.post_id}|${r.platform}`;
    if (seen.has(key)) continue;
    seen.add(key);
    latest.push(r);
  }
  return latest;
}

const angleLabel = (p: SocialPost) => {
  const a = p.angle ?? p.kind ?? 'other';
  return a.charAt(0).toUpperCase() + a.slice(1);
};

// Per-platform display: proper label + brand icon (data carries the raw
// platform key). Unknown platforms fall back to a capitalised label + globe.
const PLATFORM_META: Record<
  string,
  { label: string; icon: 'logo-instagram' | 'logo-tiktok' | 'logo-reddit' | 'globe-outline' }
> = {
  instagram: { label: 'Instagram', icon: 'logo-instagram' },
  tiktok: { label: 'TikTok', icon: 'logo-tiktok' },
  reddit: { label: 'Reddit', icon: 'logo-reddit' },
};
const platformMeta = (p: string) =>
  PLATFORM_META[p] ?? {
    label: p.charAt(0).toUpperCase() + p.slice(1),
    icon: 'globe-outline' as const,
  };

// Web-only file pick (the admin surface is web). Resolves null when the DOM is
// unavailable or no file is chosen; a cancelled dialog simply never resolves,
// which is fine — no state is touched until a file arrives.
const pickCsvText = (): Promise<string | null> =>
  new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve(null);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv';
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      f.text().then(resolve, () => resolve(null));
    };
    input.click();
  });

export function SocialInsightsDomain() {
  const qc = useQueryClient();
  const postsQ = useQuery({ queryKey: ['socialPosts'], queryFn: listSocialPosts });
  const resultsQ = useQuery({ queryKey: ['socialPostResults'], queryFn: listPostResults });
  const channelQ = useQuery({ queryKey: ['socialChannelStats'], queryFn: listChannelStats });
  const narrow = useWindowDimensions().width < 640;
  // One control per connected platform — pulls that platform's post metrics
  // into social_post_results. TikTok is read-only analytics (no reply API).
  const [syncing, setSyncing] = useState<'instagram' | 'tiktok' | 'csv' | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const runSync = async (platform: 'instagram' | 'tiktok') => {
    setSyncing(platform);
    setSyncMsg(null);
    const label = platform === 'tiktok' ? 'TikTok' : 'Instagram';
    try {
      const r = platform === 'tiktok' ? await syncTiktok() : await syncInstagram();
      setSyncMsg(`Synced ${r.matched} ${label} post${r.matched === 1 ? '' : 's'}`);
      qc.invalidateQueries({ queryKey: ['socialPostResults'] });
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : `${label} sync failed`);
    }
    setSyncing(null);
    setTimeout(() => setSyncMsg(null), 4000);
  };

  // Plain render helper (not a component) so its identity is stable across
  // renders — eslint's "no components during render" rule.
  const renderSyncButton = (
    platform: 'instagram' | 'tiktok',
    icon: 'logo-instagram' | 'logo-tiktok',
    label: string,
  ) => (
    <Pressable
      key={platform}
      style={styles.syncBtn}
      onPress={() => runSync(platform)}
      disabled={syncing !== null}
      hitSlop={6}
    >
      {syncing === platform ? (
        <ActivityIndicator size="small" color={GOLD} />
      ) : (
        <Ionicons name={icon} size={14} color={COLORS.navy} />
      )}
      <Text style={styles.syncBtnText}>{syncing === platform ? 'Syncing…' : label}</Text>
    </Pressable>
  );

  // TikTok Studio CSV import — the no-developer-account analytics route.
  // Accepts both exports (Analytics › Download data): the Overview daily series
  // → social_channel_stats, the per-post Content export → caption-matched
  // social_post_results, auto-detected from the file's headers.
  const runCsvImport = async () => {
    const text = await pickCsvText();
    if (!text) return;
    setSyncing('csv');
    setSyncMsg(null);
    try {
      const parsed = parseTiktokCsv(text);
      if (parsed.kind === 'overview') {
        const r = await importChannelStats('tiktok', parsed.rows);
        setSyncMsg(`Imported ${r.imported} days of TikTok channel stats`);
        qc.invalidateQueries({ queryKey: ['socialChannelStats'] });
      } else {
        const r = await importTiktokContentResults(parsed.rows);
        setSyncMsg(
          `Matched ${r.matched}/${r.scanned} TikTok posts` +
            (r.unmatched.length ? ` · ${r.unmatched.length} unmatched` : '') +
            (r.ambiguous.length ? ` · ${r.ambiguous.length} ambiguous (log manually)` : ''),
        );
        qc.invalidateQueries({ queryKey: ['socialPostResults'] });
      }
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : 'CSV import failed');
    }
    setSyncing(null);
    setTimeout(() => setSyncMsg(null), 6000);
  };

  const syncBtn = (
    <View style={styles.syncRow}>
      {syncMsg ? <Text style={styles.syncMsg}>{syncMsg}</Text> : null}
      {renderSyncButton('instagram', 'logo-instagram', 'Pull Instagram')}
      {renderSyncButton('tiktok', 'logo-tiktok', 'Pull TikTok')}
      <Pressable
        style={styles.syncBtn}
        onPress={runCsvImport}
        disabled={syncing !== null}
        hitSlop={6}
      >
        {syncing === 'csv' ? (
          <ActivityIndicator size="small" color={GOLD} />
        ) : (
          <Ionicons name="document-attach-outline" size={14} color={COLORS.navy} />
        )}
        <Text style={styles.syncBtnText}>{syncing === 'csv' ? 'Importing…' : 'Import CSV'}</Text>
      </Pressable>
    </View>
  );

  if (postsQ.isLoading || resultsQ.isLoading) {
    return (
      <Panel title="Insights">
        <SkRows n={5} />
      </Panel>
    );
  }

  const posts = postsQ.data ?? [];
  const postById = new Map(posts.map((p) => [p.id, p]));
  const latest = latestPerPostPlatform(resultsQ.data ?? []);

  // Daily channel trend (account-level, from the Overview CSV import). Rendered
  // whether or not per-post results exist — it's a different lens on the loop.
  const channelRows = (channelQ.data ?? []).filter((c) => c.platform === 'tiktok').slice(-30);
  const channelPanel = channelRows.length ? (
    <Panel
      title="Channel — TikTok daily views"
      hint="From the TikTok Studio Overview export"
      style={styles.panel}
    >
      <View style={styles.chanBars}>
        {channelRows.map((r) => {
          const maxV = Math.max(1, ...channelRows.map((c) => c.views ?? 0));
          return (
            <View
              key={r.day}
              style={[styles.chanBar, { height: Math.max(2, ((r.views ?? 0) / maxV) * 64) }]}
            />
          );
        })}
      </View>
      <View style={styles.chanMetaRow}>
        <Text style={styles.chanMeta}>
          {channelRows[0].day} → {channelRows[channelRows.length - 1].day}
        </Text>
        <Text style={styles.chanMeta}>
          peak {fmt(Math.max(...channelRows.map((c) => c.views ?? 0)))} · last 7d{' '}
          {fmt(channelRows.slice(-7).reduce((a, c) => a + (c.views ?? 0), 0))}
        </Text>
      </View>
    </Panel>
  ) : null;

  if (latest.length === 0) {
    return (
      <View style={styles.wrap}>
        <Panel title="Insights" hint="Numbers appear here as results come in" action={syncBtn}>
          <EmptyState text="No results yet — hit Pull Instagram / Pull TikTok, use Import CSV (TikTok Studio › Analytics › Download data), or log numbers from Post today › Posted (reddit & instagram refresh nightly)." />
        </Panel>
        {channelPanel}
      </View>
    );
  }

  // ── headline totals (latest snapshot per post+platform, summed) ─────────────
  const sum = (pick: (r: SocialPostResult) => number | null) =>
    latest.reduce((acc, r) => acc + (pick(r) ?? 0), 0);
  const totalViews = sum((r) => r.views);
  const totalLikes = sum((r) => r.likes);
  const totalComments = sum((r) => r.comments);
  const measuredPosts = new Set(latest.map((r) => r.post_id)).size;

  // ── the rebiasing signal: average views per post, by format ─────────────────
  type AngleAgg = {
    angle: string;
    posts: Set<string>;
    views: number;
    likes: number;
    comments: number;
  };
  const byAngle = new Map<string, AngleAgg>();
  for (const r of latest) {
    const post = postById.get(r.post_id);
    if (!post) continue;
    const angle = angleLabel(post);
    const agg = byAngle.get(angle) ?? {
      angle,
      posts: new Set<string>(),
      views: 0,
      likes: 0,
      comments: 0,
    };
    agg.posts.add(r.post_id);
    agg.views += r.views ?? 0;
    agg.likes += r.likes ?? 0;
    agg.comments += r.comments ?? 0;
    byAngle.set(angle, agg);
  }
  const angleRows = [...byAngle.values()]
    .map((a) => ({
      angle: a.angle,
      n: a.posts.size,
      avgViews: a.views / a.posts.size,
      avgEngage: (a.likes + a.comments) / a.posts.size,
    }))
    .sort((x, y) => y.avgViews - x.avgViews || y.avgEngage - x.avgEngage);
  const maxAvg = Math.max(1, ...angleRows.map((a) => a.avgViews));

  // ── per-platform split ──────────────────────────────────────────────────────
  type PlatAgg = {
    platform: string;
    posts: Set<string>;
    views: number;
    likes: number;
    comments: number;
  };
  const byPlatform = new Map<string, PlatAgg>();
  for (const r of latest) {
    const agg = byPlatform.get(r.platform) ?? {
      platform: r.platform,
      posts: new Set<string>(),
      views: 0,
      likes: 0,
      comments: 0,
    };
    agg.posts.add(r.post_id);
    agg.views += r.views ?? 0;
    agg.likes += r.likes ?? 0;
    agg.comments += r.comments ?? 0;
    byPlatform.set(r.platform, agg);
  }
  const platformRows = [...byPlatform.values()].sort((a, b) => b.views - a.views);

  // ── top performers: attention per post across platforms ────────────────────
  const perPost = new Map<
    string,
    { views: number; likes: number; comments: number; platforms: string[] }
  >();
  for (const r of latest) {
    const agg = perPost.get(r.post_id) ?? { views: 0, likes: 0, comments: 0, platforms: [] };
    agg.views += r.views ?? 0;
    agg.likes += r.likes ?? 0;
    agg.comments += r.comments ?? 0;
    agg.platforms.push(r.platform);
    perPost.set(r.post_id, agg);
  }
  const topPosts = [...perPost.entries()]
    .map(([id, agg]) => ({ post: postById.get(id), ...agg }))
    .filter((t): t is typeof t & { post: SocialPost } => !!t.post)
    .sort((a, b) => b.views - a.views || b.likes + b.comments - (a.likes + a.comments))
    .slice(0, 5);

  const newest = (resultsQ.data ?? [])[0];
  const autoCount = (resultsQ.data ?? []).filter((r) => r.source === 'auto').length;
  const best = angleRows.find((a) => a.n >= 1); // leaderboard is sorted by avg views

  return (
    <View style={styles.wrap}>
      {/* HERO BAND — one dominant number + the single takeaway, supporting KPIs beside it */}
      <Panel style={styles.panel} action={syncBtn}>
        <View style={styles.hero}>
          <View style={styles.heroPrimary}>
            <Text style={styles.heroValue}>{fmt(totalViews)}</Text>
            <Text style={styles.heroLabel}>TOTAL VIEWS / REACH</Text>
            <Text style={styles.heroSub}>
              across {measuredPosts} post{measuredPosts === 1 ? '' : 's'}
              {autoCount ? ' · auto-synced' : ''}
            </Text>
          </View>
          {narrow ? null : <View style={styles.heroDivider} />}
          <View style={styles.heroSecondary}>
            <View style={styles.heroMini}>
              <Text style={styles.heroMiniValue}>{fmt(totalLikes)}</Text>
              <Text style={styles.heroMiniLabel}>likes</Text>
            </View>
            <View style={styles.heroMini}>
              <Text style={styles.heroMiniValue}>{fmt(totalComments)}</Text>
              <Text style={styles.heroMiniLabel}>comments</Text>
            </View>
            {best ? (
              <View style={[styles.heroMini, styles.heroBest, narrow && styles.heroBestNarrow]}>
                <Text style={styles.heroBestLabel}>BEST FORMAT</Text>
                <Text style={styles.heroBestValue}>{best.angle}</Text>
                <Text style={styles.heroBestSub}>{fmt(Math.round(best.avgViews))} avg reach</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Panel>

      {/* WORKSPACE — the decision tool (left) beside platform context (right rail) */}
      <View style={[styles.split, narrow && styles.splitNarrow]}>
        <Panel
          title="What's working"
          hint="Avg views per post, by format — this steers the next batch"
          style={[styles.panel, styles.splitMain, narrow && styles.splitItemNarrow]}
        >
          {angleRows.map((a, i) => (
            <View key={a.angle} style={styles.angleRow}>
              <View style={styles.angleHead}>
                <Text style={[styles.angleName, i === 0 && styles.angleNameTop]}>{a.angle}</Text>
                <Text style={styles.angleMeta}>
                  {a.n} post{a.n === 1 ? '' : 's'} · <Ionicons name="heart" size={10} />
                  <Ionicons name="chatbubble" size={10} /> {fmt(Math.round(a.avgEngage))} avg
                </Text>
                <Text style={styles.angleValue}>{fmt(Math.round(a.avgViews))}</Text>
              </View>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${Math.max(3, (a.avgViews / maxAvg) * 100)}%` },
                    i > 0 && styles.barFillDim,
                  ]}
                />
              </View>
            </View>
          ))}
        </Panel>

        <Panel
          title="By platform"
          hint="Where the attention lives"
          style={[styles.panel, styles.splitRail, narrow && styles.splitItemNarrow]}
        >
          {platformRows.map((p) => (
            <View key={p.platform} style={styles.platRow}>
              <View style={styles.platNameRow}>
                <Ionicons name={platformMeta(p.platform).icon} size={13} color={COLORS.navy} />
                <Text style={styles.platName}>{platformMeta(p.platform).label}</Text>
              </View>
              <View style={styles.platNums}>
                <Text style={styles.platViews}>
                  {p.views ? (
                    <>
                      {'\u2009'}
                      <Ionicons name="eye" size={11} /> {fmt(p.views)}
                    </>
                  ) : (
                    '—'
                  )}
                </Text>
                <Text style={styles.platSub}>
                  <Ionicons name="heart" size={10} /> {fmt(p.likes)} ·{' '}
                  <Ionicons name="chatbubble" size={10} /> {fmt(p.comments)} · {p.posts.size} post
                  {p.posts.size === 1 ? '' : 's'}
                </Text>
              </View>
            </View>
          ))}
          <Text style={styles.footNote}>
            reddit &amp; instagram refresh nightly · tiktok: Import CSV from TikTok Studio (its API
            app is optional)
          </Text>
        </Panel>
      </View>

      {channelPanel}

      {/* TOP PERFORMERS — full width so thumbnails + numbers breathe */}
      <Panel title="Top performers" hint="Make more like these" style={styles.panel}>
        {topPosts.map((t, i) => (
          <View key={t.post.id} style={styles.topRow}>
            <Text style={styles.topRank}>{i + 1}</Text>
            <View style={styles.topThumbWrap}>
              <Image
                source={{ uri: t.post.image_url }}
                style={styles.topThumb}
                contentFit="cover"
              />
            </View>
            <View style={styles.topMeta}>
              <Text style={styles.topTitle} numberOfLines={1}>
                {t.post.title}
              </Text>
              <View style={styles.topChips}>
                <Text style={styles.topAngle}>{angleLabel(t.post)}</Text>
                {[...new Set(t.platforms)].map((pf) => (
                  <Text key={pf} style={styles.topPlatform}>
                    {platformMeta(pf).label}
                  </Text>
                ))}
              </View>
            </View>
            <View style={styles.topNums}>
              <Text style={styles.topViews}>{fmt(t.views)}</Text>
              <Text style={styles.topSub}>
                <Ionicons name="heart" size={10} /> {fmt(t.likes)} ·{' '}
                <Ionicons name="chatbubble" size={10} /> {fmt(t.comments)}
              </Text>
            </View>
          </View>
        ))}
      </Panel>
    </View>
  );
}

const styles = StyleSheet.create({
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  platNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  syncMsg: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: PAPER_TEXT.faint },
  wrap: { gap: 12, width: '100%' },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.22)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  syncBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },
  panel: { marginBottom: 0 },

  // Hero band
  hero: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 22 },
  heroPrimary: { minWidth: 150 },
  heroValue: {
    fontFamily: 'Flame-Regular',
    fontSize: 56,
    lineHeight: 58,
    color: GOLD,
    fontVariant: ['tabular-nums'],
  },
  heroLabel: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 11,
    letterSpacing: 0.8,
    color: 'rgba(41,60,67,0.6)',
    marginTop: 2,
  },
  heroSub: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 12,
    color: 'rgba(41,60,67,0.45)',
    marginTop: 3,
  },
  heroDivider: { width: 1, alignSelf: 'stretch', backgroundColor: 'rgba(41,60,67,0.1)' },
  heroSecondary: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 24, flex: 1 },
  heroMini: { gap: 1 },
  heroMiniValue: {
    fontFamily: 'Flame-Regular',
    fontSize: 26,
    color: COLORS.navy,
    fontVariant: ['tabular-nums'],
  },
  heroMiniLabel: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: COLORS.grey },
  heroBestNarrow: { marginLeft: 0 },
  heroBest: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(224,168,62,0.1)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  heroBestLabel: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 9.5,
    letterSpacing: 0.8,
    color: '#a8791f',
  },
  heroBestValue: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 17,
    color: COLORS.navy,
    marginTop: 1,
  },
  heroBestSub: { fontFamily: 'Nunito_600SemiBold', fontSize: 11, color: 'rgba(41,60,67,0.55)' },

  // What's working — single-hue magnitude bars, direct-labeled
  angleRow: { marginBottom: 14 },
  angleHead: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 6 },
  angleName: { fontFamily: 'Nunito_800ExtraBold', fontSize: 14, color: COLORS.navy },
  angleNameTop: { color: '#a8791f' },
  angleMeta: {
    flex: 1,
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 11.5,
    color: 'rgba(41,60,67,0.5)',
  },
  angleValue: {
    fontFamily: 'Flame-Regular',
    fontSize: 18,
    lineHeight: 22,
    color: COLORS.navy,
    fontVariant: ['tabular-nums'],
  },
  barTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(41,60,67,0.1)',
    overflow: 'hidden',
  },
  barFill: { height: 10, borderRadius: 999, backgroundColor: GOLD },
  barFillDim: { backgroundColor: 'rgba(224,168,62,0.55)' },

  split: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' },
  splitMain: { flexGrow: 2, flexBasis: 460, minWidth: 0 },
  splitRail: { flexGrow: 1, flexBasis: 280, minWidth: 0 },
  // Narrow: stack the two panels full-width instead of relying on flex-wrap +
  // flexBasis math (RN defaults flexShrink to 0, so a 280/460 basis won't shrink
  // to fit a 366px column — the rail spilled ~18px past the viewport). Column +
  // stretch makes each panel exactly the content width; flexBasis:auto/grow:0
  // stops the basis being read as a height in the column axis.
  splitNarrow: { flexDirection: 'column', alignItems: 'stretch' },
  splitItemNarrow: { flexBasis: 'auto', flexGrow: 0, width: '100%' },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(41,60,67,0.08)',
  },
  topRank: {
    width: 22,
    fontFamily: 'Flame-Regular',
    fontSize: 18,
    color: GOLD,
    textAlign: 'center',
  },
  topThumbWrap: {
    width: 46,
    height: 58,
    borderRadius: 9,
    overflow: 'hidden',
    backgroundColor: 'rgba(41,60,67,0.08)',
  },
  topThumb: { width: '100%', height: '100%' },
  topMeta: { flex: 1, gap: 3, minWidth: 0 },
  topTitle: { fontFamily: 'Nunito_700Bold', fontSize: 13.5, color: COLORS.navy },
  topChips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  topAngle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: GOLD,
  },
  topPlatform: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: 'rgba(41,60,67,0.5)',
  },
  topNums: { alignItems: 'flex-end', gap: 1 },
  topViews: {
    fontFamily: 'Flame-Regular',
    fontSize: 17,
    color: COLORS.navy,
    fontVariant: ['tabular-nums'],
  },
  topSub: { fontFamily: 'Nunito_600SemiBold', fontSize: 10.5, color: 'rgba(41,60,67,0.5)' },

  platRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(41,60,67,0.08)',
  },
  platName: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 13,
    textTransform: 'capitalize',
    color: COLORS.navy,
  },
  // minWidth 0 + shrink: the stats line ("145 likes · 29 comments") otherwise
  // sets the row's min-content width and pushes the panel past 390px viewports;
  // with shrink it wraps to a second line instead.
  platNums: { alignItems: 'flex-end', gap: 1, flexShrink: 1, minWidth: 0 },
  platViews: {
    fontFamily: 'Flame-Regular',
    fontSize: 15,
    color: COLORS.navy,
    fontVariant: ['tabular-nums'],
  },
  platSub: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 10.5,
    color: 'rgba(41,60,67,0.5)',
    textAlign: 'right',
  },
  // Channel trend — bottom-aligned daily bars, single hue (magnitude only)
  chanBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 64 },
  chanBar: { flex: 1, borderRadius: 2, backgroundColor: GOLD },
  chanMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  chanMeta: { fontFamily: 'Nunito_600SemiBold', fontSize: 11, color: 'rgba(41,60,67,0.5)' },

  footNote: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 11,
    color: 'rgba(41,60,67,0.45)',
    marginTop: 10,
  },
});
