import { supabase } from '../supabase';
import type { Tables } from '../../types/database.generated';
import { matchByCaption, type TiktokContentRow, type TiktokOverviewRow } from '../social/tiktokCsv';

// Social posting queue — published from the local studio (publish-posts.mjs),
// consumed by the command-center Social lane. Reads/updates are admin-gated RLS.
export type SocialPost = Tables<'social_posts'>;

/** All published posts, launch batch first, then weeks (newest first), in order. */
export async function listSocialPosts(): Promise<SocialPost[]> {
  const { data, error } = await supabase
    .from('social_posts')
    .select('*')
    .order('batch', { ascending: false })
    .order('ord', { ascending: true });
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  // 'launch' sorts after 'week-*' descending; surface it first explicitly.
  return [...rows.filter((r) => r.batch === 'launch'), ...rows.filter((r) => r.batch !== 'launch')];
}

/** Toggle posted state (stores/clears the timestamp). */
export async function setSocialPosted(id: string, posted: boolean): Promise<void> {
  const { error } = await supabase
    .from('social_posts')
    .update({ posted_at: posted ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Per-post performance logging (social_post_results) ───────────────────────
// Snapshots per (post, platform); numbers grow over time so re-logging adds a
// new snapshot and the latest recorded_at per platform wins in rollups.
export type SocialPostResult = Tables<'social_post_results'>;

export async function listPostResults(): Promise<SocialPostResult[]> {
  const { data, error } = await supabase
    .from('social_post_results')
    .select('*')
    .order('recorded_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function logPostResult(input: {
  post_id: string;
  platform: string;
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  post_url?: string | null;
}): Promise<void> {
  const { error } = await supabase.from('social_post_results').insert(input);
  if (error) throw new Error(error.message);
}

// ── CSV import (the no-API TikTok route) ─────────────────────────────────────
// TikTok Studio › Analytics › Download data → drop the file in Publish ›
// Insights. Overview rows land in social_channel_stats (daily account trend);
// Content rows caption-match to queue posts exactly like tiktok-sync would.

export type SocialChannelStat = Tables<'social_channel_stats'>;

/** Daily channel series, oldest first. */
export async function listChannelStats(): Promise<SocialChannelStat[]> {
  const { data, error } = await supabase
    .from('social_channel_stats')
    .select('*')
    .order('day', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Upsert the Overview export's daily rows — re-imports refresh in place. */
export async function importChannelStats(
  platform: string,
  rows: TiktokOverviewRow[],
): Promise<{ imported: number }> {
  if (rows.length === 0) return { imported: 0 };
  const { error } = await supabase.from('social_channel_stats').upsert(
    rows.map((r) => ({
      platform,
      day: r.day,
      views: r.views,
      profile_views: r.profileViews,
      likes: r.likes,
      comments: r.comments,
      shares: r.shares,
      imported_at: new Date().toISOString(),
    })),
    { onConflict: 'platform,day' },
  );
  if (error) throw new Error(error.message);
  return { imported: rows.length };
}

/** Match the Content export's per-post rows to queue posts by caption and
 *  write result snapshots (platform=tiktok, source=manual). Substring match —
 *  posted captions often drop the first line — and an ambiguous hit (several
 *  queue posts share the caption) is reported, never guessed. */
export async function importTiktokContentResults(
  rows: TiktokContentRow[],
): Promise<{ scanned: number; matched: number; unmatched: string[]; ambiguous: string[] }> {
  const { data: posts, error } = await supabase.from('social_posts').select('id, caption');
  if (error) throw new Error(error.message);
  const snapshots: {
    post_id: string;
    platform: string;
    views: number | null;
    likes: number | null;
    comments: number | null;
    shares: number | null;
    post_url: string | null;
    source: string;
  }[] = [];
  const unmatched: string[] = [];
  const ambiguous: string[] = [];
  for (const r of rows) {
    const { post, candidates } = matchByCaption(r.caption, posts ?? []);
    if (!post) {
      (candidates > 1 ? ambiguous : unmatched).push(r.caption.slice(0, 60));
      continue;
    }
    snapshots.push({
      post_id: post.id,
      platform: 'tiktok',
      views: r.views,
      likes: r.likes,
      comments: r.comments,
      shares: r.shares,
      post_url: r.postUrl,
      source: 'manual',
    });
  }
  if (snapshots.length > 0) {
    const { error: insErr } = await supabase.from('social_post_results').insert(snapshots);
    if (insErr) throw new Error(insErr.message);
  }
  return { scanned: rows.length, matched: snapshots.length, unmatched, ambiguous };
}

/** Trigger the Instagram sync edge function — matches recent IG media to queue
 *  posts by caption and writes fresh result snapshots. Returns the summary. */
export async function syncInstagram(): Promise<{
  scanned: number;
  matched: number;
  unmatched: number;
}> {
  const { data, error } = await supabase.functions.invoke<{
    scanned: number;
    matched: number;
    unmatched: number;
  }>('ig-sync', { body: {} });
  if (error) throw new Error(error.message);
  return data ?? { scanned: 0, matched: 0, unmatched: 0 };
}

/** Trigger the TikTok sync edge function — matches recent TikTok videos to
 *  queue posts by caption and writes fresh result snapshots (platform=tiktok).
 *  Read-only analytics; TikTok has no reply-to-comments write API. */
export async function syncTiktok(): Promise<{
  scanned: number;
  matched: number;
  unmatched: number;
}> {
  const { data, error } = await supabase.functions.invoke<{
    scanned: number;
    matched: number;
    unmatched: number;
  }>('tiktok-sync', { body: {} });
  if (error) throw new Error(error.message);
  return data ?? { scanned: 0, matched: 0, unmatched: 0 };
}
