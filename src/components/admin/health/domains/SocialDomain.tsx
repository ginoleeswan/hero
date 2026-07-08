// Command-center domain: the social posting queue. Content is generated +
// published from the local Social Studio (scripts/social/publish-posts.mjs);
// this lane is the anywhere-device posting checklist — preview each post, copy
// its caption, tick it off. Posted-state lives in social_posts (admin RLS),
// so it syncs across devices. Web-only, like the rest of the command center.
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Panel } from '../Panel';
import { SkRows } from '../skeletons';
import { COLORS } from '../../../../constants/colors';
import { listSocialPosts, setSocialPosted, type SocialPost } from '../../../../lib/db/socialPosts';

const GOLD = '#e0a83e';

function batchLabel(batch: string): string {
  if (batch === 'launch') return 'Launch plan — first three posts';
  const m = batch.match(/^week-(\d{4}-\d{2}-\d{2})$/);
  return m ? `Content week · ${m[1]}` : batch;
}

function PostRow({ post, onToggle }: { post: SocialPost; onToggle: (p: SocialPost) => void }) {
  const [copied, setCopied] = useState(false);
  // Carousel slides expand inline (multi-tab window.open is popup-blocked after
  // the first — only one slide ever opened, esp. on iOS Safari). Each thumbnail
  // opens its own tab from its own tap, which blockers allow.
  const [slidesOpen, setSlidesOpen] = useState(false);
  const posted = !!post.posted_at;

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
    <View style={[styles.row, posted && styles.rowDone]}>
      <Pressable onPress={() => window.open(post.image_url, '_blank')}>
        <Image source={{ uri: post.image_url }} style={styles.thumb} contentFit="cover" />
      </Pressable>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          {post.day ? <Text style={styles.day}>{post.day.toUpperCase()}</Text> : null}
          <Text style={styles.title} numberOfLines={1}>
            {post.title}
          </Text>
          <Text style={post.ad_safety === 'ad_safe' ? styles.badgeSafe : styles.badgeOrganic}>
            {post.ad_safety === 'ad_safe' ? 'BOOST OK' : 'ORGANIC ONLY'}
          </Text>
          {post.slide_urls.length > 1 ? (
            <Text style={styles.slides}>{post.slide_urls.length} slides</Text>
          ) : null}
        </View>
        {post.guide_where ? (
          <Text style={styles.guide}>
            {post.guide_where}
            {post.guide_when ? ` · ${post.guide_when}` : ''}
          </Text>
        ) : null}
        {post.guide_music ? <Text style={styles.music}>♪ {post.guide_music}</Text> : null}
        <View style={styles.actions}>
          <Pressable style={styles.miniBtn} onPress={copyCaption} disabled={!post.caption}>
            <Text style={styles.miniBtnText}>{copied ? 'Copied ✓' : 'Copy caption'}</Text>
          </Pressable>
          {post.slide_urls.length > 1 ? (
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
    </View>
  );
}

export function SocialDomain() {
  const qc = useQueryClient();
  const postsQ = useQuery({ queryKey: ['socialPosts'], queryFn: listSocialPosts });

  const onToggle = async (p: SocialPost) => {
    await setSocialPosted(p.id, !p.posted_at);
    qc.invalidateQueries({ queryKey: ['socialPosts'] });
  };

  const posts = postsQ.data ?? [];
  const batches = [...new Set(posts.map((p) => p.batch))];

  return (
    <View style={styles.wrap}>
      {/* Boosting rules — mirrors scripts/social/safety.mjs (the tier system).
          Organic posting is unrestricted; PAID ads are tier-gated. */}
      <Panel title="Safe to post?" hint="Organic is unrestricted — boosting (paid ads) is tier-gated">
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
            Ads-pipeline output (brand, tier-checked matchups/rankings) — safe to put money behind.
          </Text>
        </View>
      </Panel>
      {postsQ.isLoading ? (
        <Panel title="Social queue">
          <SkRows n={4} />
        </Panel>
      ) : posts.length === 0 ? (
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
        batches.map((batch) => {
          const group = posts.filter((p) => p.batch === batch);
          const done = group.filter((p) => p.posted_at).length;
          return (
            <Panel
              key={batch}
              title={batchLabel(batch)}
              hint={`${done}/${group.length} posted`}
              style={styles.panel}
            >
              {group.map((p) => (
                <PostRow key={p.id} post={p} onToggle={onToggle} />
              ))}
            </Panel>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  panel: { marginBottom: 12 },
  empty: { color: COLORS.grey, fontSize: 13, lineHeight: 19 },
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  rowDone: { opacity: 0.45 },
  thumb: { width: 64, height: 80, borderRadius: 8, backgroundColor: '#0b1c27' },
  body: { flex: 1, minWidth: 0, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
  title: { flex: 1, color: COLORS.black, fontSize: 13.5, fontWeight: '700' },
  slides: { color: COLORS.grey, fontSize: 11 },
  guide: { color: COLORS.grey, fontSize: 11.5 },
  music: { color: '#8a6420', fontSize: 11.5 },
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
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  miniBtn: {
    borderWidth: 1,
    borderColor: 'rgba(224,168,62,0.55)',
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  miniBtnText: { color: '#8a6420', fontSize: 11.5, fontWeight: '700' },
  postedBtn: {
    marginLeft: 'auto',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  postedOn: { borderColor: 'rgba(46,160,90,0.5)', backgroundColor: 'rgba(46,160,90,0.08)' },
  postedText: { color: COLORS.grey, fontSize: 11.5, fontWeight: '600' },
  postedTextOn: { color: '#2ea05a' },
});
