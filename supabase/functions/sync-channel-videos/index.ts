// sync-channel-videos — read the official studio channels directly.
//
// The companion to sync-title-videos, and the answer to the thing that one
// cannot fix. TMDB is community-maintained: on 2026-08-15, hours into D23, it
// held no Avengers: Doomsday "Special Look", no Ahsoka season-2 trailer and no
// VisionQuest trailer. Sweeping TMDB more often finds none of them, because
// they were not there. Marvel's own channel had the Doomsday Special Look at
// 04:06 UTC the same morning.
//
// Source: youtube.com/feeds/videos.xml?channel_id=… — no API key, no quota, no
// credential to rotate, 15 most recent uploads with exact publish times. At an
// hourly sweep that is a wide margin.
//
// This function only INGESTS. Matching a video to a catalogue title and deciding
// whether it is a real trailer both live in match_channel_videos() so they can be
// re-run over history without re-fetching, and so the judgement is inspectable
// as SQL rather than buried in a Deno regex.
//
// POST body: { limit?: number, triggeredBy?: string }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type SB = ReturnType<typeof createClient>;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), {
    status: s,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const FEED = 'https://www.youtube.com/feeds/videos.xml?channel_id=';

interface ChannelRow {
  id: string;
  name: string;
}

interface FeedEntry {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  published_at: string;
}

/** Minimal entity decode. The feed is XML, so titles arrive with &amp; and
 *  friends; anything left encoded shows up verbatim in the rail's copy. */
function decode(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(Number(d)))
    // Ampersand last: decoding it first would let "&amp;lt;" become "<".
    .replace(/&amp;/g, '&');
}

const pick = (block: string, tag: string): string | null => {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? decode(m[1]).trim() || null : null;
};

/**
 * Parse the Atom feed with regex rather than a DOM parser.
 *
 * Justified narrowly: this is one machine-generated feed shape from one vendor,
 * every field we read is a leaf element with no nesting, and pulling a DOM
 * library into the edge runtime to read five fields is a worse trade. A shape
 * change degrades to zero entries and a counted warning, never a throw.
 */
export function parseFeed(xml: string): FeedEntry[] {
  const out: FeedEntry[] = [];
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const block = m[1];
    const id = pick(block, 'yt:videoId');
    const title = pick(block, 'title');
    const published = pick(block, 'published');
    if (!id || !title || !published) continue;
    const ms = Date.parse(published);
    if (Number.isNaN(ms)) continue;
    const thumb = block.match(/<media:thumbnail[^>]*url="([^"]+)"/);
    out.push({
      id,
      title,
      description: pick(block, 'media:description'),
      thumbnail_url: thumb ? decode(thumb[1]) : null,
      published_at: new Date(ms).toISOString(),
    });
  }
  return out;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  let limit = 50;
  let triggeredBy = 'cron';
  try {
    const b = await req.json().catch(() => ({}));
    if (typeof b?.limit === 'number') limit = Math.min(Math.max(1, b.limit), 200);
    if (typeof b?.triggeredBy === 'string') triggeredBy = b.triggeredBy;
  } catch {
    /* empty body ok */
  }

  const sb: SB = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const { data: channels, error } = await sb
    .from('media_channels')
    .select('id, name')
    .eq('enabled', true)
    .order('checked_at', { ascending: true, nullsFirst: true })
    .limit(limit);
  if (error) return json({ error: error.message }, 500);

  let fetched = 0;
  let upserted = 0;
  const failed: string[] = [];

  for (const ch of (channels ?? []) as unknown as ChannelRow[]) {
    try {
      const res = await fetch(`${FEED}${encodeURIComponent(ch.id)}`, {
        headers: { 'User-Agent': 'Mythique/1.0 (+https://mythique.app)' },
      });
      if (!res.ok) {
        failed.push(`${ch.name}:${res.status}`);
        continue;
      }
      const entries = parseFeed(await res.text());
      fetched += entries.length;
      if (entries.length === 0) {
        // A live channel always has entries, so zero means the feed shape moved
        // or the id is wrong. Surfaced rather than silently counted as success.
        failed.push(`${ch.name}:empty`);
      }

      if (entries.length) {
        const rows = entries.map((e) => ({ ...e, channel_id: ch.id }));
        // Title and thumbnail can be edited after upload; published_at cannot.
        // first_seen_at and title_id are left alone by omission.
        const { error: upErr } = await sb
          .from('channel_videos')
          .upsert(rows, { onConflict: 'id', ignoreDuplicates: false });
        if (upErr) failed.push(`${ch.name}:${upErr.message}`);
        else upserted += rows.length;
      }

      const newest = entries.reduce<string | null>(
        (acc, e) => (acc === null || e.published_at > acc ? e.published_at : acc),
        null,
      );
      await sb
        .from('media_channels')
        .update({ checked_at: new Date().toISOString(), last_video_at: newest })
        .eq('id', ch.id);

      // Courtesy pacing. These are unauthenticated public feeds and there is no
      // reason to hit them as fast as the runtime allows.
      await sleep(120);
    } catch (e) {
      failed.push(`${ch.name}:${e instanceof Error ? e.message : 'error'}`);
    }
  }

  // One statement does all matching and promotion for everything ingested.
  const { data: matched, error: matchErr } = await sb.rpc('match_channel_videos');

  return json({
    channels: channels?.length ?? 0,
    fetched,
    upserted,
    matched: matchErr ? { error: matchErr.message } : matched,
    failed,
    triggeredBy,
  });
});
