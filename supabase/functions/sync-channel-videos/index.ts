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
const TMDB_API_KEY = Deno.env.get('TMDB_API_KEY') ?? '';
const TMDB_BASE = 'https://api.themoviedb.org/3';

/** Same shape test the promotion step uses. Discovery is only attempted for
 *  videos that claim to be trailers, so a sizzle clip or a cast interview can
 *  never mint a catalogue row. */
const TRAILERISH =
  /(official trailer|final trailer|new trailer|teaser|first look|special look|sneak peek)/i;

/**
 * A video title is a marketing string; TMDB wants a work's name.
 *
 * "Percy Jackson & the Olympians Season 3 | Teaser Trailer | Disney+" has to
 * become "Percy Jackson & the Olympians". Take the first pipe-delimited segment
 * (studios put the work first and the ceremony after), then strip the season
 * marker and any remaining trailer vocabulary.
 */
/** Mirror of the SQL `normalize_match_text`. The discovery guard is only sound
 *  if it applies the SAME test the matcher will: TMDB spells "Percy Jackson and
 *  the Olympians" while the trailer says "&", so a literal containment check
 *  rejects the correct series. Change both together. */
export function normalizeMatchText(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function searchQueryFromVideoTitle(raw: string): string | null {
  let s = raw.split('|')[0];
  s = s.replace(/\b(season|series|part|chapter|vol\.?|volume)\s+\d+\b/gi, ' ');
  s = s.replace(
    /\b(official|final|new)?\s*(trailer|teaser|first look|special look|sneak peek|showcase)\b/gi,
    ' ',
  );
  // Possessive studio prefixes: "Marvel Television's VisionQuest".
  s = s.replace(/^.*?['’]s\s+/, '');
  s = s.replace(/[-–—:]\s*$/, '').replace(/\s+/g, ' ').trim();
  return s.length >= 5 ? s : null;
}

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

/**
 * The specific work a video is about, when the matcher only saw the franchise.
 *
 * "Shawn Levy and Ryan Gosling Introduce Star Wars: Starfighter at D23" matched
 * `Star Wars` — the 1977 film — because that really is the longest catalogue
 * title inside the string. The work being announced is Star Wars: Starfighter,
 * and it is right there after the colon. Same for "The Mandalorian and Grogu".
 *
 * Returns null when there is nothing more specific to find, in which case the
 * caller falls back to the ordinary query cleaner.
 */
export function specificWorkFromTitle(videoTitle: string, matchedTitle: string): string | null {
  const i = videoTitle.toLowerCase().indexOf(matchedTitle.toLowerCase());
  if (i < 0) return null;
  const after = videoTitle.slice(i + matchedTitle.length);
  // ": Starfighter" / " and Grogu" / " - Modern Warfare 4". Capitalised, because
  // a continuation of a proper title is, and ordinary prose after a title is not.
  const m = after.match(/^\s*(:|-|–|\band\b)\s+([A-Z][\w''-]*(?:\s+[A-Z0-9][\w''-]*){0,3})/);
  if (!m) return null;
  // Keep the connector. "The Mandalorian and Grogu" is the work's actual name;
  // dropping the "and" produces a query TMDB has no reason to resolve.
  const joiner = m[1] === 'and' ? ' and' : ':';
  return `${matchedTitle}${joiner} ${m[2].trim()}`.replace(/\s+/g, ' ').trim();
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
      const xml = await res.text();
      const entries = parseFeed(xml);
      fetched += entries.length;
      if (entries.length === 0) {
        // Zero entries has two very different causes, and conflating them makes
        // this list useless. A VALID feed carries <yt:channelId> even when the
        // channel simply has no recent uploads — Netflix Geeked returns exactly
        // that. Reporting a healthy-but-quiet channel as a failure every hour is
        // how a failure list becomes something nobody reads. Only a response
        // that is not a feed at all — wrong id, changed shape, error page — is
        // worth surfacing.
        if (!xml.includes('<yt:channelId>')) failed.push(`${ch.name}:not-a-feed`);
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

  // ── discovery ──────────────────────────────────────────────────────────────
  // An unmatched TRAILER is not a failure, it is a finding: a studio is
  // promoting something the catalogue does not have. Disney+ posted the Percy
  // Jackson season-3 teaser and it matched nothing, because `titles` held only
  // the 2010 and 2013 films — the Disney+ series was never ingested. Every such
  // video is a title worth having, already filtered to things a studio thought
  // worth cutting a trailer for.
  //
  // The guard against minting junk is deliberately circular: the TMDB result is
  // only accepted if its name is CONTAINED in the video title, which is exactly
  // the test match_title_for_video will apply afterwards. If it would not match
  // once inserted, it does not get inserted.
  const discovered: string[] = [];
  if (TMDB_API_KEY) {
    // Includes videos that DID match, but to a title nothing new could be about
    // — see channel_videos_needing_discovery.
    const { data: orphans } = await sb.rpc('channel_videos_needing_discovery', { p_limit: 24 });

    const rows: Record<string, unknown>[] = [];
    // Videos that produced a title. Their `matched_at` is already set from the
    // failed first attempt, and match_channel_videos only considers rows where
    // it is null — so without clearing it the re-match below would be a no-op
    // and the trailer would wait a whole sweep for the row minted for it.
    const retry: string[] = [];
    let calls = 0;
    const attempted: string[] = [];
    for (const o of (orphans ?? []) as unknown as {
      id: string;
      title: string;
      matched_title: string | null;
    }[]) {
      if (calls >= 12) break;
      attempted.push(o.id);
      // A weakly-matched video does not have to look like a trailer: the X-Men
      // cast reveal is news whatever its title shape. An UNMATCHED one still
      // does, or every studio short would mint a catalogue row.
      const weak = !!o.matched_title;
      if (!weak && !TRAILERISH.test(o.title)) continue;
      const q = (o.matched_title
        ? specificWorkFromTitle(o.title, o.matched_title)
        : null) ?? searchQueryFromVideoTitle(o.title);
      if (!q) continue;
      try {
        calls++;
        const r = await fetch(
          `${TMDB_BASE}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(q)}`,
        );
        if (!r.ok) continue;
        const body = await r.json();
        const hit = (body.results ?? []).find((x: Record<string, unknown>) => {
          if (x.media_type !== 'movie' && x.media_type !== 'tv') return false;
          const name = (x.title ?? x.name) as string | undefined;
          if (!name) return false;
          const norm = normalizeMatchText(name);
          if (norm.length < 5) return false;
          return normalizeMatchText(o.title).includes(norm);
        });
        if (!hit) continue;
        const mediaType = hit.media_type === 'tv' ? 'tv' : 'film';
        const name = (hit.title ?? hit.name) as string;
        rows.push({
          id: `tmdb:${hit.id}`,
          source: 'tmdb',
          external_id: String(hit.id),
          media_type: mediaType,
          title: name,
          release_date: hit.release_date || hit.first_air_date || null,
          poster_url: hit.poster_path ? `https://image.tmdb.org/t/p/w500${hit.poster_path}` : null,
          backdrop_url: hit.backdrop_path
            ? `https://image.tmdb.org/t/p/w1280${hit.backdrop_path}`
            : null,
          overview: hit.overview || null,
          // Thin row at `pending`; the existing enrich-tmdb drain fills in cast,
          // images and the rest on its own schedule.
          enrich_status: 'pending',
        });
        discovered.push(`${name} (${mediaType})`);
        retry.push(o.id);
        await sleep(120);
      } catch {
        /* one bad search never fails the sweep */
      }
    }

    if (rows.length) {
      // ignoreDuplicates: an existing row is already richer than this thin one.
      await sb.from('titles').upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
      // Clear the match so the corrected, more specific title can win — the
      // matcher prefers active titles, and the newly minted one is active.
      await sb
        .from('channel_videos')
        .update({ matched_at: null, title_id: null })
        .in('id', retry);
    }
    // Stamped whether or not anything was found: a video with nothing better
    // behind it must not be re-searched on every sweep for a fortnight.
    if (attempted.length) {
      await sb
        .from('channel_videos')
        .update({ discovery_at: new Date().toISOString() })
        .in('id', attempted);
    }
    if (calls > 0) {
      await sb.from('api_usage').insert({ api: 'tmdb', endpoint: 'search/multi', units: calls });
    }
  }

  // Re-match: anything just discovered can now find its title on this same pass,
  // so a trailer is never a sweep behind the row that was minted for it.
  const { data: rematched } = discovered.length
    ? await sb.rpc('match_channel_videos')
    : { data: null };

  return json({
    channels: channels?.length ?? 0,
    fetched,
    upserted,
    matched: matchErr ? { error: matchErr.message } : matched,
    discovered,
    rematched,
    failed,
    triggeredBy,
  });
});
