// Command-center domain: the social posting queue. Content is generated +
// published from the local Social Studio (scripts/social/publish-posts.mjs);
// this lane is the anywhere-device posting checklist — preview each post, copy
// its caption, tick it off. Posted-state lives in social_posts (admin RLS),
// so it syncs across devices. Web-only, like the rest of the command center.
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Panel } from '../Panel';
import { CardGrid, PillGroup } from '../ui';
import { CC } from '../format';
import { SkRows } from '../skeletons';
import { COLORS } from '../../../../constants/colors';
import {
  listSocialPosts,
  setSocialPosted,
  listPostResults,
  logPostResult,
  type SocialPost,
  type SocialPostResult,
} from '../../../../lib/db/socialPosts';

const GOLD = '#e0a83e';

// Single narrow breakpoint for the whole lane. Below it, the two-column
// desktop layout collapses to one full-width column (see the *Narrow styles).
const useNarrow = () => useWindowDimensions().width < 640;

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
// Load-time clock for day labels — module scope keeps render pure.
const LOADED_AT = Date.now();

const asDownload = (url: string, name: string) =>
  url.replace(/\/(image|video)\/upload\//, (_m, kind) => `/${kind}/upload/fl_attachment:${name}/`);

function usePostActions(post: SocialPost) {
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
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

  // Native share sheet WITH the media attached (mobile Safari/Chrome): tap
  // Instagram/TikTok in the sheet and the composer opens with files loaded.
  // The closest thing to one-tap posting without platform API approval.
  const [sharing, setSharing] = useState(false);
  const canShareFiles =
    typeof navigator !== 'undefined' && !!navigator.canShare && !!navigator.share;
  const shareToApps = async () => {
    setSharing(true);
    try {
      const urls =
        isVideo && post.video_url
          ? [post.video_url]
          : post.slide_urls.length
            ? post.slide_urls
            : [post.image_url];
      const files = await Promise.all(
        urls.map(async (u, i) => {
          const res = await fetch(u);
          const blob = await res.blob();
          const ext = isVideo ? 'mp4' : 'png';
          return new File([blob], `${post.batch}-${post.ord}-${i + 1}.${ext}`, {
            type: blob.type,
          });
        }),
      );
      if (navigator.canShare?.({ files })) {
        await navigator.share({ files, text: post.caption });
      } else {
        await navigator.share({ text: post.caption });
      }
    } catch {
      /* user dismissed the sheet, or share unsupported */
    }
    setSharing(false);
  };

  return { copied, saving, sharing, isVideo, canShareFiles, saveAll, copyCaption, shareToApps };
}

// The caption's trailing hashtag block — IG best practice is hashtags in the
// FIRST COMMENT, so they copy separately from the caption body.
function splitCaption(caption: string) {
  const lines = caption.split('\n');
  const tagLine =
    lines.findLast?.((l) => l.trim().startsWith('#')) ??
    [...lines].reverse().find((l) => l.trim().startsWith('#'));
  if (!tagLine) return { body: caption, tags: null };
  return {
    body: lines
      .filter((l) => l !== tagLine)
      .join('\n')
      .trim(),
    tags: tagLine.trim(),
  };
}

// The hero of the Queue view — media-first, like the top schedulers: the
// creative dominates (real 4:5 preview), the plan rides beside it, ONE
// primary action. Everything else is secondary.
function TodayCard({
  post,
  onToggle,
  onSkip,
}: {
  post: SocialPost;
  onToggle: (p: SocialPost) => void;
  onSkip?: () => void;
}) {
  const { copied, saving, sharing, isVideo, canShareFiles, saveAll, copyCaption, shareToApps } =
    usePostActions(post);
  const [savedOnce, setSavedOnce] = useState(false);
  const [copiedOnce, setCopiedOnce] = useState(false);
  const [tagsCopied, setTagsCopied] = useState(false);
  const { tags } = splitCaption(post.caption ?? '');
  const narrow = useNarrow();
  const copyTags = async () => {
    if (!tags) return;
    try {
      await navigator.clipboard.writeText(tags);
      setTagsCopied(true);
      setTimeout(() => setTagsCopied(false), 1400);
    } catch {
      /* clipboard unavailable */
    }
  };
  const intentX = () =>
    window.open(
      `https://twitter.com/intent/post?text=${encodeURIComponent((post.caption ?? '').slice(0, 270))}`,
      '_blank',
    );
  const fileCount = isVideo ? 1 : post.slide_urls.length || 1;
  const step = (
    n: string,
    label: string,
    done: boolean,
    onPress: () => void,
    opts: { primary?: boolean; disabled?: boolean } = {},
  ) => (
    <Pressable
      style={[styles.stepRow, opts.primary && styles.stepRowPrimary, done && styles.stepRowDone]}
      onPress={onPress}
      disabled={opts.disabled}
    >
      <View
        style={[styles.stepNum, opts.primary && styles.stepNumPrimary, done && styles.stepNumDone]}
      >
        {done ? (
          <Ionicons name="checkmark" size={13} color="#fff" />
        ) : (
          <Text style={[styles.stepNumText, opts.primary && styles.stepNumTextPrimary]}>{n}</Text>
        )}
      </View>
      <Text
        style={[
          styles.stepLabel,
          opts.primary && styles.stepLabelPrimary,
          done && styles.stepLabelDone,
        ]}
      >
        {label}
      </Text>
      <Ionicons
        name="chevron-forward"
        size={14}
        color={opts.primary ? 'rgba(255,255,255,0.8)' : 'rgba(41,60,67,0.35)'}
      />
    </Pressable>
  );
  return (
    <View style={[styles.todayCard, narrow && styles.todayCardNarrow]}>
      <Pressable
        style={[styles.todayMedia, narrow && styles.todayMediaNarrow]}
        onPress={() => window.open(isVideo ? post.video_url! : post.image_url, '_blank')}
      >
        <Image source={{ uri: post.image_url }} style={styles.todayMediaImg} contentFit="cover" />
        {isVideo ? (
          <View style={styles.playBadge}>
            <Text style={styles.playBadgeText}>▶</Text>
          </View>
        ) : null}
        {!isVideo && post.slide_urls.length > 1 ? (
          <View style={styles.todaySlideCount}>
            <Text style={styles.todaySlideCountText}>1 / {post.slide_urls.length}</Text>
          </View>
        ) : null}
      </Pressable>
      <View style={[styles.todayMeta, narrow && styles.todayMetaNarrow]}>
        <View style={styles.titleRow}>
          <Text style={post.ad_safety === 'ad_safe' ? styles.badgeSafe : styles.badgeOrganic}>
            {post.ad_safety === 'ad_safe' ? 'BOOST OK' : 'ORGANIC ONLY'}
          </Text>
          {isVideo ? <Text style={styles.badgeReel}>REEL</Text> : null}
        </View>
        <Text style={styles.todayTitle}>{post.title}</Text>
        {post.guide_where ? <Text style={styles.todayWhere}>→ {post.guide_where}</Text> : null}
        {post.guide_music ? (
          <Text style={styles.music} numberOfLines={2}>
            ♪ {post.guide_music}
          </Text>
        ) : null}
        {post.caption ? (
          <Pressable
            style={styles.todayCaption}
            onPress={() => {
              copyCaption();
              setCopiedOnce(true);
            }}
          >
            <Text style={styles.todayCaptionText} numberOfLines={3}>
              {post.caption}
            </Text>
            <Text style={styles.todayCaptionHint}>{copied ? 'Copied ✓' : 'tap to copy'}</Text>
          </Pressable>
        ) : null}
        <View style={styles.todaySteps}>
          {step(
            '1',
            saving
              ? 'Saving…'
              : fileCount > 1
                ? `Save the ${fileCount} files`
                : isVideo
                  ? 'Save the reel'
                  : 'Save the image',
            savedOnce && !saving,
            () => {
              saveAll();
              setSavedOnce(true);
            },
            { disabled: saving },
          )}
          {step(
            '2',
            copied ? 'Caption copied ✓' : 'Copy the caption',
            copiedOnce && !copied,
            () => {
              copyCaption();
              setCopiedOnce(true);
            },
            { disabled: !post.caption },
          )}
          <View style={styles.platformRow}>
            <Text style={styles.platformLabel}>3 · POST IT</Text>
            {canShareFiles ? (
              <Pressable style={styles.platformChip} onPress={shareToApps} disabled={sharing}>
                <Ionicons name="share-outline" size={14} color={COLORS.navy} />
                <Text style={styles.platformChipText}>
                  {sharing ? 'Opening…' : 'Share to apps'}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              style={styles.platformChip}
              onPress={() => window.open('https://www.tiktok.com/upload', '_blank')}
            >
              <Text style={styles.platformChipText}>TikTok</Text>
            </Pressable>
            <Pressable
              style={styles.platformChip}
              onPress={() => window.open('https://www.instagram.com/', '_blank')}
            >
              <Text style={styles.platformChipText}>Instagram</Text>
            </Pressable>
            <Pressable style={styles.platformChip} onPress={intentX}>
              <Text style={styles.platformChipText}>X</Text>
            </Pressable>
            {tags ? (
              <Pressable style={styles.platformChip} onPress={copyTags}>
                <Text style={styles.platformChipText}>
                  {tagsCopied ? 'Tags ✓' : '# 1st comment'}
                </Text>
              </Pressable>
            ) : null}
          </View>
          {step('4', 'Posted — mark it done', false, () => onToggle(post), { primary: true })}
          {onSkip ? (
            <Pressable onPress={onSkip} hitSlop={6} style={styles.skipLink}>
              <Text style={styles.skipLinkText}>Not feeling this one? Skip to the next →</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// One row of the "This week" rail: day chip, thumb, title, lane dot.
function WeekRow({ post, day }: { post: SocialPost; day: string }) {
  const isVideo = post.media_type === 'video' && !!post.video_url;
  return (
    <Pressable
      style={styles.weekRow}
      onPress={() => window.open(isVideo ? post.video_url! : post.image_url, '_blank')}
    >
      <Text style={styles.weekDay}>{day}</Text>
      <View style={styles.weekThumbWrap}>
        <Image source={{ uri: post.image_url }} style={styles.weekThumb} contentFit="cover" />
        {isVideo ? (
          <View style={styles.playBadgeSm}>
            <Text style={styles.playBadgeTextSm}>▶</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.weekMeta}>
        <Text style={styles.weekTitle} numberOfLines={1}>
          {post.title}
        </Text>
        <Text style={styles.weekWhere} numberOfLines={1}>
          {post.guide_where ?? (isVideo ? 'Reels · TikTok' : 'IG · TikTok')}
        </Text>
      </View>
      <View
        style={[
          styles.dayLaneDotInline,
          { backgroundColor: post.ad_safety === 'ad_safe' ? '#63A936' : COLORS.orange },
        ]}
      />
    </Pressable>
  );
}

const PLATFORMS = ['tiktok', 'instagram', 'x', 'linkedin', 'reddit'] as const;
const fmtCount = (n: number | null | undefined) =>
  n == null
    ? null
    : n >= 1000000
      ? `${(n / 1000000).toFixed(1)}m`
      : n >= 1000
        ? `${(n / 1000).toFixed(1)}k`
        : String(n);

// A shipped post in the log: latest numbers inline, tap to log a snapshot.
// Ten-second entry: platform chip + views/likes/comments, done.
function HistoryRow({
  post,
  day,
  results,
  onLogged,
}: {
  post: SocialPost;
  day: string;
  results: SocialPostResult[];
  onLogged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<string>(PLATFORMS[0]);
  const [views, setViews] = useState('');
  const [likes, setLikes] = useState('');
  const [comments, setComments] = useState('');
  const [postUrl, setPostUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const latestByPlatform = new Map<string, SocialPostResult>();
  for (const r of results)
    if (!latestByPlatform.has(r.platform)) latestByPlatform.set(r.platform, r);
  const summary = [...latestByPlatform.values()]
    .map((r) => {
      const bits = [
        fmtCount(r.views) && `👁 ${fmtCount(r.views)}`,
        fmtCount(r.likes) && `❤️ ${fmtCount(r.likes)}`,
        fmtCount(r.comments) && `💬 ${fmtCount(r.comments)}`,
      ].filter(Boolean);
      return `${r.platform}: ${bits.join(' ')}`;
    })
    .join('  ·  ');
  const save = async () => {
    const num = (v: string) => (v.trim() ? Number(v.replace(/[^0-9]/g, '')) : null);
    if (!num(views) && !num(likes) && !num(comments) && !postUrl.trim()) return;
    setBusy(true);
    try {
      await logPostResult({
        post_id: post.id,
        platform,
        views: num(views),
        likes: num(likes),
        comments: num(comments),
        post_url: postUrl.trim() || null,
      });
      setViews('');
      setLikes('');
      setComments('');
      setOpen(false);
      onLogged();
    } catch {
      /* surfaced by the unchanged inputs */
    }
    setBusy(false);
  };
  return (
    <View>
      <View style={styles.weekRow}>
        <Text style={styles.weekDay}>{day}</Text>
        <View style={styles.weekThumbWrap}>
          <Image source={{ uri: post.image_url }} style={styles.weekThumb} contentFit="cover" />
        </View>
        <View style={styles.weekMeta}>
          <Text style={styles.weekTitle} numberOfLines={1}>
            {post.title}
          </Text>
          <Text style={styles.weekWhere} numberOfLines={1}>
            {summary || 'No results logged yet'}
          </Text>
        </View>
        <Pressable style={styles.resultBtn} onPress={() => setOpen((v) => !v)} hitSlop={6}>
          <Text style={styles.resultBtnText}>{open ? '×' : summary ? '+' : 'log'}</Text>
        </Pressable>
      </View>
      {open ? (
        <View style={styles.resultForm}>
          <View style={styles.resultPlatforms}>
            {PLATFORMS.map((pf) => (
              <Pressable
                key={pf}
                style={[styles.resultChip, platform === pf && styles.resultChipOn]}
                onPress={() => setPlatform(pf)}
              >
                <Text style={[styles.resultChipText, platform === pf && styles.resultChipTextOn]}>
                  {pf}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.resultInputs}>
            <TextInput
              style={styles.resultInput}
              placeholder="views"
              placeholderTextColor="rgba(41,60,67,0.4)"
              value={views}
              onChangeText={setViews}
              inputMode="numeric"
            />
            <TextInput
              style={styles.resultInput}
              placeholder="likes"
              placeholderTextColor="rgba(41,60,67,0.4)"
              value={likes}
              onChangeText={setLikes}
              inputMode="numeric"
            />
            <TextInput
              style={styles.resultInput}
              placeholder="comments"
              placeholderTextColor="rgba(41,60,67,0.4)"
              value={comments}
              onChangeText={setComments}
              inputMode="numeric"
            />
            <Pressable style={styles.resultSave} onPress={save} disabled={busy}>
              <Text style={styles.resultSaveText}>{busy ? '…' : 'Save'}</Text>
            </Pressable>
          </View>
          <TextInput
            style={styles.resultInput}
            placeholder="post link (reddit links auto-update nightly)"
            placeholderTextColor="rgba(41,60,67,0.4)"
            value={postUrl}
            onChangeText={setPostUrl}
            inputMode="url"
            autoCapitalize="none"
          />
        </View>
      ) : null}
    </View>
  );
}

function PostRow({ post, onToggle }: { post: SocialPost; onToggle: (p: SocialPost) => void }) {
  const { copied, saving, isVideo, saveAll, copyCaption } = usePostActions(post);
  // Carousel slides expand inline (multi-tab window.open is popup-blocked after
  // the first — only one slide ever opened, esp. on iOS Safari). Each thumbnail
  // opens its own tab from its own tap, which blockers allow.
  const [slidesOpen, setSlidesOpen] = useState(false);
  const posted = !!post.posted_at;

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
  const narrow = useNarrow();
  const postsQ = useQuery({ queryKey: ['socialPosts'], queryFn: listSocialPosts });
  const resultsQ = useQuery({ queryKey: ['socialPostResults'], queryFn: listPostResults });
  const resultsByPost = new Map<string, SocialPostResult[]>();
  for (const r of resultsQ.data ?? []) {
    const arr = resultsByPost.get(r.post_id) ?? [];
    arr.push(r);
    resultsByPost.set(r.post_id, arr);
  }
  // Boosting rules are reference material — collapsed by default so the queue
  // (the actual work) leads the lane.
  const [rulesOpen, setRulesOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [view, setView] = useState<PubView>('queue');
  // Per-batch collapse; fully-posted batches start collapsed (see render).
  const [openBatches, setOpenBatches] = useState<Record<string, boolean>>({});
  // "Skip" rotates today's pick without marking it posted (session-local).
  const [skipCount, setSkipCount] = useState(0);

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
  const upNext =
    dailyQueue[skipCount % Math.max(1, dailyQueue.length)] ?? allPosts.find((p) => !p.posted_at);

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

  const dayLabel = (offset: number) => {
    if (offset === 0) return 'TMRW';
    const d = new Date(LOADED_AT + (offset + 1) * 86400000);
    return d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  };
  const todayStr = new Date(LOADED_AT).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const monthPct = monthlyAll.length ? (monthlyDone / monthlyAll.length) * 100 : 0;

  // Cadence heartbeat: the last 7 days as dots (posted that day = lit), plus
  // the current daily streak. Uses posted_at we already record on toggle.
  const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10);
  const postedDays = new Set(
    allPosts.filter((p) => p.posted_at).map((p) => dayKey(new Date(p.posted_at!).getTime())),
  );
  const week = Array.from({ length: 7 }, (_, i) => {
    const t = LOADED_AT - (6 - i) * 86400000;
    return {
      letter: new Date(t).toLocaleDateString('en-US', { weekday: 'narrow' }),
      lit: postedDays.has(dayKey(t)),
      isToday: i === 6,
    };
  });
  let streak = 0;
  for (let i = postedDays.has(dayKey(LOADED_AT)) ? 0 : 1; ; i++) {
    if (postedDays.has(dayKey(LOADED_AT - i * 86400000))) streak++;
    else break;
  }
  const postedLog = allPosts
    .filter((p) => p.posted_at)
    .sort((a, b) => (b.posted_at! > a.posted_at! ? 1 : -1));
  const historyOpen = openBatches['__history'] ?? false;

  const queueView = (
    <View style={styles.queueRow}>
      <View style={[styles.queueMain, narrow && styles.laneNarrow]}>
        <Panel style={styles.panel}>
          <View style={styles.streakRow}>
            <View style={styles.weekDots}>
              {week.map((d, i) => (
                <View key={i} style={styles.weekDotCol}>
                  <View
                    style={[
                      styles.weekDot,
                      d.lit && styles.weekDotLit,
                      d.isToday && styles.weekDotToday,
                    ]}
                  />
                  <Text style={styles.weekDotLabel}>{d.letter}</Text>
                </View>
              ))}
            </View>
            <View style={styles.streakMeta}>
              <Text style={styles.streakText}>
                {streak > 0 ? `🔥 ${streak}-day streak` : 'Start your streak today'}
              </Text>
              <Text style={styles.streakSub}>
                {monthlyDone}/{monthlyAll.length} this month
              </Text>
            </View>
          </View>
        </Panel>
        {upNext ? (
          <Panel
            title={`Today · ${todayStr}`}
            hint={`${monthlyDone}/${monthlyAll.length} posted this month`}
            style={styles.panel}
          >
            <View style={styles.progTrack}>
              <View style={[styles.progFill, { width: `${monthPct}%` }]} />
            </View>
            <TodayCard
              post={upNext}
              onToggle={onToggle}
              onSkip={dailyQueue.length > 1 ? () => setSkipCount((c) => c + 1) : undefined}
            />
          </Panel>
        ) : (
          <Panel title="Post today" hint="Everything is posted 🎉">
            <Text style={styles.empty}>
              Generate next month's packs: organic-pack.mjs + batch-month.mjs
            </Text>
          </Panel>
        )}
      </View>
      <View style={[styles.queueRail, narrow && styles.laneNarrow]}>
        {dailyQueue.length > 1 ? (
          <Panel
            title="This week"
            hint={`${dailyQueue.length - 1} queued — organic & ads alternate`}
            style={styles.panel}
          >
            {dailyQueue.slice(1, 7).map((p, i) => (
              <WeekRow key={p.id} post={p} day={dayLabel(i)} />
            ))}
          </Panel>
        ) : null}
        {postedLog.length ? (
          <Panel
            title={`Posted (${postedLog.length})`}
            hint="Your shipping log"
            style={styles.panel}
            action={
              <Pressable
                onPress={() => setOpenBatches((v) => ({ ...v, __history: !historyOpen }))}
                hitSlop={8}
                style={styles.rulesToggle}
              >
                <Text style={styles.rulesToggleText}>{historyOpen ? 'Hide' : 'Show'}</Text>
                <Ionicons
                  name={historyOpen ? 'chevron-up' : 'chevron-down'}
                  size={13}
                  color={COLORS.navy}
                />
              </Pressable>
            }
          >
            {historyOpen
              ? postedLog
                  .slice(0, 14)
                  .map((p) => (
                    <HistoryRow
                      key={p.id}
                      post={p}
                      day={new Date(p.posted_at!)
                        .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        .toUpperCase()}
                      results={resultsByPost.get(p.id) ?? []}
                      onLogged={() => qc.invalidateQueries({ queryKey: ['socialPostResults'] })}
                    />
                  ))
              : null}
          </Panel>
        ) : null}
      </View>
    </View>
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
    color: 'rgba(245,235,220,0.6)',
    marginBottom: 10,
    marginLeft: 2,
  },
  queueRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  weekDots: { flexDirection: 'row', gap: 10 },
  weekDotCol: { alignItems: 'center', gap: 4 },
  weekDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(41,60,67,0.12)',
  },
  weekDotLit: { backgroundColor: '#e0a83e' },
  weekDotToday: { borderWidth: 2, borderColor: COLORS.orange },
  weekDotLabel: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 10,
    color: 'rgba(41,60,67,0.5)',
  },
  streakMeta: { alignItems: 'flex-end', gap: 1 },
  streakText: { fontFamily: 'Nunito_800ExtraBold', fontSize: 15, color: COLORS.navy },
  streakSub: { fontFamily: 'Nunito_600SemiBold', fontSize: 12, color: 'rgba(41,60,67,0.55)' },
  queueMain: { flexGrow: 2, flexBasis: 560, minWidth: 320 },
  queueRail: { flexGrow: 1, flexBasis: 300, minWidth: 280 },
  // RN defaults flexShrink to 0, so the desktop flexBasis (560/300) would refuse
  // to shrink and overflow a phone. On narrow, each lane is one full-width column.
  laneNarrow: { flexGrow: 0, flexBasis: 'auto', minWidth: 0, width: '100%' },
  todayCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 24,
    alignItems: 'flex-start',
  },
  todayCardNarrow: { flexDirection: 'column', gap: 16 },
  todayMedia: {
    flexGrow: 1,
    flexBasis: 300,
    maxWidth: 430,
    aspectRatio: 4 / 5,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(41,60,67,0.08)',
  },
  // Mobile: a compact centered preview (not a full-screen image) so the
  // Save/Copy/Post checklist sits within the first screen.
  todayMediaNarrow: { flexGrow: 0, flexBasis: 'auto', width: 176, alignSelf: 'center' },
  todayMediaImg: { width: '100%', height: '100%' },
  todaySlideCount: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(6,18,26,0.72)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  todaySlideCountText: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: '#f5ebdc' },
  todayMeta: { flexGrow: 1, flexBasis: 300, minWidth: 280, gap: 10, paddingTop: 2 },
  todayMetaNarrow: { flexBasis: 'auto', minWidth: 0, width: '100%' },
  todayTitle: { fontFamily: 'Nunito_800ExtraBold', fontSize: 22, color: COLORS.navy },
  todayWhere: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: 'rgba(41,60,67,0.75)' },
  todayCaption: {
    backgroundColor: 'rgba(41,60,67,0.05)',
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  todayCaptionText: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(41,60,67,0.62)',
  },
  todayCaptionHint: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 10.5,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: COLORS.orange,
  },
  todaySteps: { gap: 8, marginTop: 6, alignSelf: 'stretch' },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.16)',
    backgroundColor: 'rgba(255,255,255,0.55)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  stepRowPrimary: { backgroundColor: COLORS.orange, borderColor: COLORS.orange },
  stepRowDone: { borderColor: 'rgba(99,169,54,0.5)', backgroundColor: 'rgba(99,169,54,0.08)' },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(41,60,67,0.1)',
  },
  stepNumPrimary: { backgroundColor: 'rgba(255,255,255,0.25)' },
  stepNumDone: { backgroundColor: '#63A936' },
  stepNumText: { fontFamily: 'Nunito_800ExtraBold', fontSize: 12, color: COLORS.navy },
  stepNumTextPrimary: { color: '#fff' },
  stepLabel: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.navy },
  stepLabelPrimary: { color: '#fff', fontFamily: 'Nunito_800ExtraBold' },
  stepLabelDone: { color: '#4a7d2b' },
  platformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  platformLabel: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 11,
    letterSpacing: 0.8,
    color: 'rgba(41,60,67,0.5)',
    marginRight: 2,
  },
  platformChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.2)',
    backgroundColor: 'rgba(255,255,255,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  platformChipText: { fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: COLORS.navy },
  skipLink: { alignSelf: 'center', paddingVertical: 4 },
  skipLinkText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: 'rgba(41,60,67,0.5)',
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(41,60,67,0.08)',
  },
  weekDay: {
    width: 46,
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 11,
    letterSpacing: 0.6,
    color: 'rgba(41,60,67,0.5)',
  },
  weekThumbWrap: {
    width: 52,
    height: 65,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(41,60,67,0.08)',
  },
  weekThumb: { width: '100%', height: '100%' },
  weekMeta: { flex: 1, gap: 1 },
  weekTitle: { fontFamily: 'Nunito_700Bold', fontSize: 13.5, color: COLORS.navy },
  weekWhere: { fontFamily: 'Nunito_600SemiBold', fontSize: 11.5, color: 'rgba(41,60,67,0.5)' },
  dayLaneDotInline: { width: 9, height: 9, borderRadius: 5 },
  resultBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 34,
    alignItems: 'center',
  },
  resultBtnText: { fontFamily: 'Nunito_800ExtraBold', fontSize: 12, color: COLORS.navy },
  resultForm: {
    backgroundColor: 'rgba(41,60,67,0.05)',
    borderRadius: 12,
    padding: 10,
    gap: 8,
    marginBottom: 8,
  },
  resultPlatforms: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  resultChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  resultChipOn: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  resultChipText: { fontFamily: 'Nunito_700Bold', fontSize: 11.5, color: COLORS.navy },
  resultChipTextOn: { color: '#f5ebdc' },
  resultInputs: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  resultInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.18)',
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 6,
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: COLORS.navy,
    backgroundColor: '#fff',
    minWidth: 0,
  },
  resultSave: {
    backgroundColor: COLORS.orange,
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  resultSaveText: { fontFamily: 'Nunito_800ExtraBold', fontSize: 13, color: '#fff' },
  playBadgeSm: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(6,18,26,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBadgeTextSm: { color: '#f5ebdc', fontSize: 8 },
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
