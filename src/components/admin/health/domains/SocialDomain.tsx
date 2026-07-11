// Command-center domain: the social posting queue. Content is generated +
// published from the local Social Studio (scripts/social/publish-posts.mjs);
// this lane is the anywhere-device posting checklist — preview each post, copy
// its caption, tick it off. Posted-state lives in social_posts (admin RLS),
// so it syncs across devices. Web-only, like the rest of the command center.
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Panel } from '../Panel';
import { CardGrid, PillGroup } from '../ui';
import { CC } from '../format';
import { SkRows } from '../skeletons';
import { COLORS } from '../../../../constants/colors';
import { listSocialPosts, setSocialPosted, type SocialPost } from '../../../../lib/db/socialPosts';

const GOLD = '#e0a83e';

function batchLabel(batch: string): string {
  if (batch === 'launch') return 'Launch plan — first three posts';
  if (batch === 'ad-toolkit') return 'Ad toolkit — evergreen, safe to boost';
  if (batch === 'brand-kit') return 'Brand kit — profiles, overview & announcements';
  const week = batch.match(/^week-(\d{4}-\d{2}-\d{2})$/);
  if (week) return `Content week · ${week[1]}`;
  const organic = batch.match(/^organic-(\d{4}-\d{2})$/);
  if (organic) return `Organic pack · ${organic[1]} — portraits, covers & posters (never boost)`;
  const adLibrary = batch.match(/^ad-library-(\d{4}-\d{2})$/);
  if (adLibrary) return `Ad library · ${adLibrary[1]} — safe to boost`;
  return batch;
}

type Filter =
  | 'all'
  | 'matchup'
  | 'ranking'
  | 'guess'
  | 'fact'
  | 'lore'
  | 'brand'
  | 'reel'
  | 'carousel';

// The tab is organized by JOB, not by batch: Queue = what do I post now,
// Boost = what can I put money behind, Library = browse everything.
type PubView = 'queue' | 'boost' | 'library';
const VIEW_OPTIONS: { label: string; value: PubView }[] = [
  { label: 'Post today', value: 'queue' },
  { label: 'Boost', value: 'boost' },
  { label: 'Everything', value: 'library' },
];
const VIEW_HINT: Record<PubView, string> = {
  queue: 'Your daily loop — save, post, mark done. The queue advances itself.',
  boost: 'Only content that is safe to put ad money behind.',
  library: 'Every published batch — browse and filter.',
};

// Workflow order: this month's library (the daily queue) leads, then the
// set-once brand kit, evergreen toolkit, and finally the older packs.
function batchPriority(b: string): number {
  if (b.startsWith('organic-')) return 0;
  if (b.startsWith('ad-library-')) return 0.5;
  if (b === 'brand-kit') return 1;
  if (b === 'ad-toolkit') return 2;
  if (b.startsWith('week-')) return 3;
  return 4;
}

const FILTER_OPTIONS: { label: string; value: Filter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Matchup', value: 'matchup' },
  { label: 'Ranking', value: 'ranking' },
  { label: 'Guess', value: 'guess' },
  { label: 'Fact', value: 'fact' },
  { label: 'Lore', value: 'lore' },
  { label: 'Brand', value: 'brand' },
  { label: 'Reels', value: 'reel' },
  { label: 'Carousels', value: 'carousel' },
];

// Cloudinary's fl_attachment flag turns a delivery URL into a download
// (Content-Disposition: attachment) — lets "Save all" fetch every slide/reel
// to the device without blob plumbing, incl. iOS Safari's download sheet.
const asDownload = (url: string, name: string) =>
  url.replace(/\/(image|video)\/upload\//, (_m, kind) => `/${kind}/upload/fl_attachment:${name}/`);

function PostRow({ post, onToggle }: { post: SocialPost; onToggle: (p: SocialPost) => void }) {
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  // Carousel slides expand inline (multi-tab window.open is popup-blocked after
  // the first — only one slide ever opened, esp. on iOS Safari). Each thumbnail
  // opens its own tab from its own tap, which blockers allow.
  const [slidesOpen, setSlidesOpen] = useState(false);
  const posted = !!post.posted_at;
  const isVideo = post.media_type === 'video' && !!post.video_url;

  const saveAll = () => {
    const files =
      isVideo && post.video_url
        ? [post.video_url]
        : post.slide_urls.length
          ? post.slide_urls
          : [post.image_url];
    setSaving(true);
    files.forEach((u, i) => {
      // one anchor per file, staggered — browsers throttle burst downloads
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = asDownload(u, `${post.batch}-${post.ord}-${i + 1}`);
        a.download = '';
        document.body.appendChild(a);
        a.click();
        a.remove();
      }, i * 600);
    });
    setTimeout(() => setSaving(false), files.length * 600 + 600);
  };

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(post.caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <View style={[styles.card, posted && styles.cardDone]}>
      {/* Cover + identity strip */}
      <View style={styles.cardTop}>
        <Pressable
          style={styles.thumbWrap}
          onPress={() => window.open(isVideo ? post.video_url! : post.image_url, '_blank')}
        >
          <Image source={{ uri: post.image_url }} style={styles.thumb} contentFit="cover" />
          {isVideo ? (
            <View style={styles.playBadge}>
              <Text style={styles.playBadgeText}>▶</Text>
            </View>
          ) : null}
        </Pressable>
        <View style={styles.cardHead}>
          <View style={styles.titleRow}>
            {post.day ? <Text style={styles.day}>{post.day.toUpperCase()}</Text> : null}
            <Text style={post.ad_safety === 'ad_safe' ? styles.badgeSafe : styles.badgeOrganic}>
              {post.ad_safety === 'ad_safe' ? 'BOOST OK' : 'ORGANIC ONLY'}
            </Text>
            {isVideo ? <Text style={styles.badgeReel}>REEL</Text> : null}
            {!isVideo && post.slide_urls.length > 1 ? (
              <Text style={styles.slides}>{post.slide_urls.length} slides</Text>
            ) : null}
          </View>
          <Text style={styles.title} numberOfLines={2}>
            {post.title}
          </Text>
          {post.guide_where ? (
            <Text style={styles.guide} numberOfLines={1}>
              {post.guide_where}
              {post.guide_when ? ` · ${post.guide_when}` : ''}
            </Text>
          ) : null}
        </View>
      </View>

      {post.guide_music ? (
        <Text style={styles.music} numberOfLines={2}>
          ♪ {post.guide_music}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Pressable style={styles.miniBtn} onPress={copyCaption} disabled={!post.caption}>
          <Text style={styles.miniBtnText}>{copied ? 'Copied ✓' : 'Copy caption'}</Text>
        </Pressable>
        <Pressable style={styles.miniBtn} onPress={saveAll} disabled={saving}>
          <Text style={styles.miniBtnText}>
            {saving
              ? 'Saving…'
              : isVideo
                ? 'Save reel'
                : post.slide_urls.length > 1
                  ? `Save all (${post.slide_urls.length})`
                  : 'Save'}
          </Text>
        </Pressable>
        {isVideo ? (
          <Pressable style={styles.miniBtn} onPress={() => window.open(post.video_url!, '_blank')}>
            <Text style={styles.miniBtnText}>Open reel</Text>
          </Pressable>
        ) : post.slide_urls.length > 1 ? (
          <Pressable style={styles.miniBtn} onPress={() => setSlidesOpen((v) => !v)}>
            <Text style={styles.miniBtnText}>
              {slidesOpen ? 'Hide slides' : `Slides (${post.slide_urls.length})`}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          style={[styles.postedBtn, posted && styles.postedOn]}
          onPress={() => onToggle(post)}
        >
          <Text style={[styles.postedText, posted && styles.postedTextOn]}>
            {posted ? 'posted ✓' : 'mark posted'}
          </Text>
        </Pressable>
      </View>

      {slidesOpen ? (
        <View style={styles.slideStrip}>
          {post.slide_urls.map((u, i) => (
            <Pressable key={u} onPress={() => window.open(u, '_blank')} style={styles.slideCell}>
              <Image source={{ uri: u }} style={styles.slideThumb} contentFit="cover" />
              <Text style={styles.slideNum}>{i + 1}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function SocialDomain() {
  const qc = useQueryClient();
  const postsQ = useQuery({ queryKey: ['socialPosts'], queryFn: listSocialPosts });
  // Boosting rules are reference material — collapsed by default so the queue
  // (the actual work) leads the lane.
  const [rulesOpen, setRulesOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [view, setView] = useState<PubView>('queue');
  // Per-batch collapse; fully-posted batches start collapsed (see render).
  const [openBatches, setOpenBatches] = useState<Record<string, boolean>>({});

  const onToggle = async (p: SocialPost) => {
    await setSocialPosted(p.id, !p.posted_at);
    qc.invalidateQueries({ queryKey: ['socialPosts'] });
  };

  const matches = (p: SocialPost) =>
    filter === 'all'
      ? true
      : filter === 'reel'
        ? p.media_type === 'video'
        : filter === 'carousel'
          ? p.media_type !== 'video'
          : p.angle === filter;

  const allPosts = postsQ.data ?? [];
  const posts = allPosts.filter(matches);
  const batches = [...new Set(posts.map((p) => p.batch))].sort(
    (a, b) => batchPriority(a) - batchPriority(b) || b.localeCompare(a),
  );

  // The daily queue: this month's organic pack + ad library, INTERLEAVED so
  // consecutive days vary (organic, ad, organic, ad …). Marking one posted
  // advances the queue automatically.
  const monthly = (prefix: string) =>
    allPosts
      .filter((p) => p.batch.startsWith(prefix) && !p.posted_at)
      .sort((a, b) => b.batch.localeCompare(a.batch) || a.ord - b.ord);
  const organicQ = monthly('organic-');
  const adsQ = monthly('ad-library-');
  const dailyQueue: SocialPost[] = [];
  for (let i = 0; i < Math.max(organicQ.length, adsQ.length); i++) {
    if (organicQ[i]) dailyQueue.push(organicQ[i]);
    if (adsQ[i]) dailyQueue.push(adsQ[i]);
  }
  const monthlyAll = allPosts.filter(
    (p) => p.batch.startsWith('organic-') || p.batch.startsWith('ad-library-'),
  );
  const monthlyDone = monthlyAll.filter((p) => p.posted_at).length;
  const upNext = dailyQueue[0] ?? allPosts.find((p) => !p.posted_at);

  const rulesPanel = (
    <Panel
      title="Safe to post?"
      hint="Organic is unrestricted — boosting (paid ads) is tier-gated"
      action={
        <Pressable onPress={() => setRulesOpen((v) => !v)} hitSlop={8} style={styles.rulesToggle}>
          <Text style={styles.rulesToggleText}>{rulesOpen ? 'Hide rules' : 'Rules'}</Text>
          <Ionicons
            name={rulesOpen ? 'chevron-up' : 'chevron-down'}
            size={13}
            color={COLORS.navy}
          />
        </Pressable>
      }
    >
      {rulesOpen ? (
        <>
          <View style={styles.ruleRow}>
            <Text style={styles.ruleBadgeGreen}>ORGANIC</Text>
            <Text style={styles.ruleText}>
              Post anything from the studio to feed/stories/TikTok — fan content, no restrictions.
            </Text>
          </View>
          <View style={styles.ruleRow}>
            <Text style={styles.ruleBadgeRed}>NEVER BOOST</Text>
            <Text style={styles.ruleText}>
              Tier S characters (Marvel, Disney, anime/Shueisha, Star Wars, Pokémon…) in a paid ad —
              takedown + ad-account strike risk.
            </Text>
          </View>
          <View style={styles.ruleRow}>
            <Text style={styles.ruleBadgeAmber}>STYLIZED ONLY</Text>
            <Text style={styles.ruleText}>
              Tier A (DC, Image, major game studios) may appear in ads only via the stylized ads
              pipeline (scripts/social/ads).
            </Text>
          </View>
          <View style={styles.ruleRow}>
            <Text style={styles.ruleBadgeGreen}>BOOST OK</Text>
            <Text style={styles.ruleText}>
              Ads-pipeline output (brand, tier-checked matchups/rankings) — safe to put money
              behind.
            </Text>
          </View>
        </>
      ) : null}
    </Panel>
  );

  const batchPanel = (batch: string, group: SocialPost[], title?: string) => {
    const sorted = [...group].sort(
      (a, b) => Number(!!a.posted_at) - Number(!!b.posted_at) || a.ord - b.ord,
    );
    const done = sorted.filter((p) => p.posted_at).length;
    const allDone = done === sorted.length;
    const open = openBatches[batch] ?? !allDone;
    return (
      <Panel
        key={batch}
        title={title ?? batchLabel(batch)}
        hint={`${done}/${sorted.length} posted`}
        style={styles.panel}
        action={
          <Pressable
            onPress={() => setOpenBatches((v) => ({ ...v, [batch]: !open }))}
            hitSlop={8}
            style={styles.rulesToggle}
          >
            <Text style={styles.rulesToggleText}>{open ? 'Hide' : 'Show'}</Text>
            <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={13} color={COLORS.navy} />
          </Pressable>
        }
      >
        <View style={styles.progTrack}>
          <View style={[styles.progFill, { width: `${(done / sorted.length) * 100}%` }]} />
        </View>
        {open ? (
          <CardGrid min={340}>
            {sorted.map((p) => (
              <PostRow key={p.id} post={p} onToggle={onToggle} />
            ))}
          </CardGrid>
        ) : null}
      </Panel>
    );
  };

  const queueView = (
    <>
      {upNext ? (
        <Panel
          title="Post today"
          hint={`${monthlyDone}/${monthlyAll.length} posted this month`}
          style={styles.panel}
        >
          <View style={styles.progTrack}>
            <View
              style={[
                styles.progFill,
                { width: `${monthlyAll.length ? (monthlyDone / monthlyAll.length) * 100 : 0}%` },
              ]}
            />
          </View>
          <CardGrid min={340}>
            <PostRow post={upNext} onToggle={onToggle} />
          </CardGrid>
        </Panel>
      ) : (
        <Panel title="Post today" hint="Everything is posted 🎉">
          <Text style={styles.empty}>
            Generate next month's packs: organic-pack.mjs + batch-month.mjs
          </Text>
        </Panel>
      )}
      {dailyQueue.length > 1 ? (
        <Panel
          title="Up next"
          hint={`${dailyQueue.length - 1} more in the queue — organic and ads alternate`}
          style={styles.panel}
        >
          <CardGrid min={340}>
            {dailyQueue.slice(1, 4).map((p) => (
              <PostRow key={p.id} post={p} onToggle={onToggle} />
            ))}
          </CardGrid>
        </Panel>
      ) : null}
    </>
  );

  const boostPosts = allPosts.filter((p) => p.ad_safety === 'ad_safe');
  const boostGroup = (prefix: string) => boostPosts.filter((p) => p.batch.startsWith(prefix));
  const boostView = (
    <>
      {rulesPanel}
      {boostGroup('ad-toolkit').length
        ? batchPanel(
            'ad-toolkit',
            boostGroup('ad-toolkit'),
            'Evergreen ads — start your first 3 here',
          )
        : null}
      {boostGroup('brand-kit').length
        ? batchPanel('brand-kit', boostGroup('brand-kit'), 'Brand moments — launch & announcements')
        : null}
      {[...new Set(boostGroup('ad-library-').map((p) => p.batch))]
        .sort((a, b) => b.localeCompare(a))
        .map((batch) =>
          batchPanel(
            batch,
            boostPosts.filter((p) => p.batch === batch),
          ),
        )}
    </>
  );

  const libraryView = (
    <>
      <PillGroup
        options={FILTER_OPTIONS}
        value={filter}
        onChange={setFilter}
        variant="solid"
        style={styles.filterRow}
      />
      {posts.length === 0 ? (
        <Panel title="Library" hint="No posts match this filter">
          <Text style={styles.empty}>Try a different chip above.</Text>
        </Panel>
      ) : (
        batches.map((batch) =>
          batchPanel(
            batch,
            posts.filter((p) => p.batch === batch),
          ),
        )
      )}
    </>
  );

  return (
    <View style={styles.wrap}>
      {postsQ.isLoading ? (
        <Panel title="Social queue">
          <SkRows n={4} />
        </Panel>
      ) : allPosts.length === 0 ? (
        <Panel
          title="Social queue"
          hint="Nothing published yet — generate in the Social Studio, then run: node scripts/social/publish-posts.mjs"
        >
          <Text style={styles.empty}>
            The studio (yarn social) generates content on the Mac; publishing pushes it here so you
            can post from any device.
          </Text>
        </Panel>
      ) : (
        <>
          <PillGroup
            options={VIEW_OPTIONS}
            value={view}
            onChange={setView}
            variant="solid"
            style={styles.viewRow}
          />
          <Text style={styles.viewHint}>{VIEW_HINT[view]}</Text>
          {view === 'queue' ? queueView : view === 'boost' ? boostView : libraryView}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Full width — posts fill it as a responsive card grid (CardGrid), not a
  // single stranded column.
  wrap: { gap: 12, width: '100%' },
  panel: { marginBottom: 12 },
  viewRow: {
    marginBottom: 0,
  },
  viewHint: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 12.5,
    color: 'rgba(41,60,67,0.62)',
    marginBottom: 10,
    marginLeft: 2,
  },
  progTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(41,60,67,0.12)',
    overflow: 'hidden',
    marginBottom: 12,
  },
  progFill: {
    height: 4,
    borderRadius: 999,
    backgroundColor: GOLD,
  },
  filterRow: { marginBottom: 2 },
  rulesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#efe6d6',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  rulesToggleText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },
  empty: { color: COLORS.grey, fontSize: 13, lineHeight: 19 },
  // Self-contained post card — a recessed well tile inside the batch panel, so
  // each post reads as one unit in the grid instead of a full-width row.
  card: {
    backgroundColor: CC.well,
    borderWidth: 1,
    borderColor: CC.wellBorder,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  } as object,
  cardDone: { opacity: 0.5 },
  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  cardHead: { flex: 1, minWidth: 0, gap: 4 },
  thumb: { width: 56, height: 70, borderRadius: 8, backgroundColor: '#0b1c27' },
  thumbWrap: { position: 'relative' },
  playBadge: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -10,
    marginLeft: -10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBadgeText: { color: '#fff', fontSize: 9, lineHeight: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  day: {
    color: GOLD,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    borderWidth: 1,
    borderColor: 'rgba(224,168,62,0.5)',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  title: { color: COLORS.black, fontSize: 14, fontWeight: '700', lineHeight: 18 },
  slides: { color: COLORS.grey, fontSize: 11 },
  guide: { color: COLORS.grey, fontSize: 11.5 },
  music: { color: '#8a6420', fontSize: 11.5, lineHeight: 16 },
  badgeOrganic: {
    color: '#b9892c',
    backgroundColor: 'rgba(217,164,65,0.14)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  badgeSafe: {
    color: '#2ea05a',
    backgroundColor: 'rgba(46,160,90,0.12)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  badgeReel: {
    color: '#fff',
    backgroundColor: COLORS.navy,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  ruleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 4 },
  ruleText: { flex: 1, color: COLORS.navy, fontSize: 12, lineHeight: 17 },
  ruleBadgeGreen: {
    color: '#2ea05a',
    backgroundColor: 'rgba(46,160,90,0.12)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    overflow: 'hidden',
    minWidth: 86,
    textAlign: 'center',
  },
  ruleBadgeRed: {
    color: '#c34430',
    backgroundColor: 'rgba(209,80,63,0.12)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    overflow: 'hidden',
    minWidth: 86,
    textAlign: 'center',
  },
  ruleBadgeAmber: {
    color: '#b9892c',
    backgroundColor: 'rgba(217,164,65,0.14)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    overflow: 'hidden',
    minWidth: 86,
    textAlign: 'center',
  },
  // Inline slide strip (expanded carousel preview) — wraps on narrow screens.
  slideStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  slideCell: { position: 'relative' },
  slideThumb: { width: 56, height: 70, borderRadius: 6, backgroundColor: '#0b1c27' },
  slideNum: {
    position: 'absolute',
    bottom: 3,
    right: 4,
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  miniBtn: {
    borderWidth: 1,
    borderColor: 'rgba(224,168,62,0.55)',
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  miniBtnText: { color: '#8a6420', fontSize: 11.5, fontWeight: '700' },
  postedBtn: {
    marginLeft: 'auto',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  postedOn: { borderColor: 'rgba(46,160,90,0.5)', backgroundColor: 'rgba(46,160,90,0.08)' },
  postedText: { color: COLORS.grey, fontSize: 11.5, fontWeight: '600' },
  postedTextOn: { color: '#2ea05a' },
});
