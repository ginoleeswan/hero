import { supabase } from '../supabase';

// "Always feel current" rails — characters tied to the real-world film/TV slate,
// served by the get_trending_heroes RPC over the TMDB-backed titles table and the
// hero_media_appearances graph. Read-only; the RPC does the join, dedup and
// ordering so the client just renders cards.

export type TrendingBucket = 'on_screen' | 'coming_soon' | 'streaming';

export interface TrendingHero {
  id: string;
  name: string;
  image_url: string | null;
  portrait_url: string | null;
  /** The title that put this character on the rail (e.g. "Superman"). */
  context_title: string | null;
  media_type: string | null;
  release_date: string | null;
  /** US streaming service for the `streaming` bucket (e.g. "Disney Plus"). */
  provider: string | null;
}

export async function getTrendingHeroes(
  bucket: TrendingBucket,
  limit = 20,
): Promise<TrendingHero[]> {
  const { data, error } = await supabase.rpc('get_trending_heroes', {
    p_bucket: bucket,
    p_limit: limit,
  });
  if (error) {
    console.warn('[getTrendingHeroes] error:', error.message);
    return [];
  }
  return (data ?? []) as TrendingHero[];
}

// ── Title-grouped clusters (Phase 2) ─────────────────────────────────────────
// Same buckets as above, but grouped by title so Explore can render a poster +
// its cast — making the show↔character link explicit. Ranked by TMDB popularity
// when present, recency otherwise (see get_trending_titles).

export interface TrendingTitleCharacter {
  id: string;
  name: string;
  image_url: string | null;
  portrait_url: string | null;
  /** Flat head icon — famous tier only, so every consumer must degrade. */
  avatar_url: string | null;
}

export interface TrendingTitle {
  id: string;
  title: string;
  media_type: string | null;
  release_date: string | null;
  backdrop_url: string | null;
  poster_url: string | null;
  provider: string | null;
  /** The streamer's mark (TMDB w92). Null for theatrical/unreleased titles. */
  provider_logo: string | null;
  /** TMDB synopsis — used as the auto-hero blurb. */
  overview: string | null;
  /** YouTube trailer key — present on trending-on-screen rows for a ▶ affordance. */
  trailer_key: string | null;
  characters: TrendingTitleCharacter[];
}

/** One flat row from get_trending_titles / get_trending_titles_multi — title
 *  fields repeated per character. */
export interface TrendingTitleRow {
  hero_avatar_url?: string | null;
  title_id: string;
  title: string;
  media_type: string | null;
  release_date: string | null;
  backdrop_url: string | null;
  poster_url: string | null;
  provider: string | null;
  provider_logo?: string | null;
  overview: string | null;
  hero_id: string;
  hero_name: string;
  hero_image_url: string | null;
  hero_portrait_url: string | null;
}

/** Fold flat per-character rows into grouped titles, preserving the RPC's order
 *  (titles by rank, characters by fame within each title). Shared by the single-
 *  and multi-bucket paths so their grouping can't drift. */
export function groupTitleRows(rows: TrendingTitleRow[]): TrendingTitle[] {
  const byTitle = new Map<string, TrendingTitle>();
  for (const r of rows) {
    let t = byTitle.get(r.title_id);
    if (!t) {
      t = {
        id: r.title_id,
        title: r.title,
        media_type: r.media_type,
        release_date: r.release_date,
        backdrop_url: r.backdrop_url,
        poster_url: r.poster_url,
        provider: r.provider,
        provider_logo: r.provider_logo ?? null,
        overview: r.overview,
        trailer_key: null,
        characters: [],
      };
      byTitle.set(r.title_id, t);
    }
    t.characters.push({
      id: r.hero_id,
      name: r.hero_name,
      image_url: r.hero_image_url,
      portrait_url: r.hero_portrait_url,
      avatar_url: r.hero_avatar_url ?? null,
    });
  }
  return [...byTitle.values()];
}

export async function getTrendingTitles(
  bucket: TrendingBucket,
  titleLimit = 6,
  charsPerTitle = 12,
): Promise<TrendingTitle[]> {
  const { data, error } = await supabase.rpc('get_trending_titles', {
    p_bucket: bucket,
    p_title_limit: titleLimit,
    p_chars_per_title: charsPerTitle,
  });
  if (error) {
    console.warn('[getTrendingTitles] error:', error.message);
    return [];
  }
  return groupTitleRows((data ?? []) as TrendingTitleRow[]);
}

/**
 * All trending-title buckets in ONE round-trip. The Explore home load needs three
 * buckets (on_screen / coming_soon / streaming); rather than three separate RPC
 * calls differing only by bucket, the get_trending_titles_multi RPC tags each row
 * with its bucket and we split the flat result here. Per-bucket output is identical
 * to calling getTrendingTitles for each. Degrades to empty buckets on error so a DB
 * hiccup never errors the Explore band.
 */
export async function getTrendingTitlesMulti(
  buckets: TrendingBucket[],
  titleLimit = 6,
  charsPerTitle = 12,
): Promise<Record<TrendingBucket, TrendingTitle[]>> {
  const out: Record<TrendingBucket, TrendingTitle[]> = {
    on_screen: [],
    coming_soon: [],
    streaming: [],
  };
  const { data, error } = await supabase.rpc('get_trending_titles_multi', {
    p_buckets: buckets,
    p_title_limit: titleLimit,
    p_chars_per_title: charsPerTitle,
  });
  if (error) {
    console.warn('[getTrendingTitlesMulti] error:', error.message);
    return out;
  }
  return splitTitleBuckets((data ?? []) as (TrendingTitleRow & { bucket: TrendingBucket })[]);
}

/** Split flat multi-bucket rows by bucket (preserving order), then group each
 *  into titles. Shared with the explore-bundle path. */
export function splitTitleBuckets(
  rows: (TrendingTitleRow & { bucket: TrendingBucket })[],
): Record<TrendingBucket, TrendingTitle[]> {
  const out: Record<TrendingBucket, TrendingTitle[]> = {
    on_screen: [],
    coming_soon: [],
    streaming: [],
  };
  const byBucket = new Map<TrendingBucket, TrendingTitleRow[]>();
  for (const r of rows) {
    const list = byBucket.get(r.bucket) ?? [];
    list.push(r);
    byBucket.set(r.bucket, list);
  }
  for (const [bucket, bucketRows] of byBucket) out[bucket] = groupTitleRows(bucketRows);
  return out;
}

export interface TrendingOnScreenRow {
  hero_avatar_url?: string | null;
  title_id: string;
  title: string;
  media_type: string | null;
  release_date: string | null;
  backdrop_url: string | null;
  poster_url: string | null;
  trailer_key: string | null;
  provider: string | null;
  hero_id: string;
  hero_name: string;
  hero_image_url: string | null;
  hero_portrait_url: string | null;
}

/** TMDB's daily-trending titles that have catalogue characters, ordered by
 *  trending rank. Degrades to [] so a DB hiccup never errors the Explore band. */
export async function getTrendingOnScreen(limit = 12): Promise<TrendingTitle[]> {
  const { data, error } = await supabase.rpc(
    'get_trending_on_screen' as never,
    { p_limit: limit } as never,
  );
  if (error) {
    console.warn('[getTrendingOnScreen] error:', error.message);
    return [];
  }
  return groupOnScreenRows((data ?? []) as unknown as TrendingOnScreenRow[]);
}

/** Flat get_trending_on_screen rows → grouped titles (trailer_key carried).
 *  Shared with the explore-bundle path. */
export function groupOnScreenRows(rows: TrendingOnScreenRow[]): TrendingTitle[] {
  const byId = new Map<string, TrendingTitle>();
  for (const r of rows) {
    let t = byId.get(r.title_id);
    if (!t) {
      t = {
        id: r.title_id,
        title: r.title,
        media_type: r.media_type,
        release_date: r.release_date,
        backdrop_url: r.backdrop_url,
        poster_url: r.poster_url,
        provider: r.provider,
        // get_trending_on_screen doesn't select a logo; the What's Hot sidebar
        // this feeds shows a rank + name, not a provider mark.
        provider_logo: null,
        overview: null,
        trailer_key: r.trailer_key,
        characters: [],
      };
      byId.set(r.title_id, t);
    }
    t.characters.push({
      id: r.hero_id,
      name: r.hero_name,
      image_url: r.hero_image_url,
      portrait_url: r.hero_portrait_url,
      avatar_url: r.hero_avatar_url ?? null,
    });
  }
  return [...byId.values()];
}

// ── Editorial campaigns (Phase 3) ────────────────────────────────────────────

export interface Campaign {
  id: string;
  label: string;
  headline: string;
  blurb: string | null;
  accent: string | null;
  /** Linked title's TMDB landscape still — purpose-composed for the wide hero
   *  band. Null for franchise-/hero-only campaigns; UI falls back to character art. */
  backdrop_url: string | null;
  poster_url: string | null;
  /** Linked title id — tapping the hero cover routes here (the media page). */
  title_id: string | null;
  /** YouTube key, when this campaign was chosen *because* of a trailer drop.
   *  Null for manual campaigns and for popularity-picked heroes. */
  trailer_key: string | null;
  characters: TrendingTitleCharacter[];
}

/** One flat row from the get_active_campaigns RPC. */
export interface CampaignRow {
  hero_avatar_url?: string | null;
  campaign_id: string;
  label: string;
  headline: string;
  blurb: string | null;
  accent: string | null;
  backdrop_url: string | null;
  poster_url: string | null;
  title_id: string | null;
  hero_id: string;
  hero_name: string;
  hero_image_url: string | null;
  hero_portrait_url: string | null;
}

/** Flat RPC rows → grouped campaigns. Shared with the explore-bundle path. */
export function groupCampaignRows(rows: CampaignRow[]): Campaign[] {
  const byId = new Map<string, Campaign>();
  for (const r of rows) {
    let c = byId.get(r.campaign_id);
    if (!c) {
      c = {
        id: r.campaign_id,
        label: r.label,
        headline: r.headline,
        blurb: r.blurb,
        accent: r.accent,
        backdrop_url: r.backdrop_url,
        poster_url: r.poster_url,
        title_id: r.title_id,
        trailer_key: null,
        characters: [],
      };
      byId.set(r.campaign_id, c);
    }
    c.characters.push({
      id: r.hero_id,
      name: r.hero_name,
      image_url: r.hero_image_url,
      portrait_url: r.hero_portrait_url,
      avatar_url: r.hero_avatar_url ?? null,
    });
  }
  return [...byId.values()];
}

/** Active editorial campaigns (premieres, events, launches) resolved to their
 *  characters. Empty when nothing is scheduled for right now. */
export async function getActiveCampaigns(limit = 3, chars = 16): Promise<Campaign[]> {
  const { data, error } = await supabase.rpc('get_active_campaigns', {
    p_limit: limit,
    p_chars: chars,
  });
  if (error) {
    console.warn('[getActiveCampaigns] error:', error.message);
    return [];
  }
  const manual = groupCampaignRows((data ?? []) as CampaignRow[]);
  if (manual.length > 0) return manual;

  // No editorial campaign live → auto-generate the hero from the trending slate so
  // the band is never stale or empty without anyone curating it. Random pick from
  // the popularity+character-gated pool (the RPC only surfaces titles that have
  // catalogue characters) keeps it fresh on refresh / return visits but relevant.
  // On-screen leads; fall back to streaming when nothing is in cinemas.
  let pool = await getTrendingTitles('on_screen', 8);
  if (pool.filter((t) => t.backdrop_url && t.characters.length > 0).length === 0) {
    pool = await getTrendingTitles('streaming', 8);
  }
  const auto = synthesizeCampaignFromPool([pool]);
  return auto ? [auto] : [];
}

/** A trailer drop, as far as the hero picker cares. Structurally the subset of
 *  db/videos.ts's TrailerEvent that matters here, so this module needn't import it. */
export interface TrailerPick {
  titleId: string;
  /** ISO-8601. */
  publishedAt: string;
  /** 'Trailer' | 'Teaser'. */
  videoType?: string | null;
}

/** How recent a trailer has to be to outrank the popularity pick. Beyond three
 *  days it isn't news any more and a random popular title is the better hero. */
export const TRAILER_HERO_MAX_AGE_HOURS = 72;

/**
 * Build a one-off Campaign for the "Right Now" hero when no editorial campaign is
 * scheduled.
 *
 * Precedence: **the newsiest title, not the luckiest.** If any pool title had a
 * trailer or teaser published inside TRAILER_HERO_MAX_AGE_HOURS, the newest such
 * drop wins — that is the single most current thing the catalogue knows. Only
 * when there's no recent drop does it fall back to the original behaviour, a
 * random pick from the popularity+character-gated pool (which keeps the hero
 * rotating on refresh instead of pinning one title for a whole staleTime).
 *
 * Pools are tried in order for the random fallback (on-screen leads, streaming
 * second), but the trailer search spans *all* pools — a streaming title with a
 * trailer from this morning beats a theatrical title with none.
 *
 * Pure aside from the random pick and, for the age cutoff, the clock — both
 * injectable so the explore bundle can feed already-fetched buckets and tests can
 * pin the outcome.
 */
export function synthesizeCampaignFromPool(
  pools: TrendingTitle[][],
  trailers: readonly TrailerPick[] = [],
  now: number = Date.now(),
): Campaign | null {
  const usable = (ts: TrendingTitle[]) =>
    ts.filter((t) => t.backdrop_url && t.characters.length > 0);

  // News first, across every pool.
  const newsworthy = newestTrailerHero(pools.map(usable).flat(), trailers, now);
  if (newsworthy) return newsworthy;

  let pool: TrendingTitle[] = [];
  for (const candidates of pools) {
    pool = usable(candidates);
    if (pool.length > 0) break;
  }
  if (pool.length === 0) return null;
  return campaignFromTitle(pool[Math.floor(Math.random() * pool.length)], null, null);
}

/** The pool title with the newest in-window trailer, as a Campaign. Null when no
 *  pool title has one. */
function newestTrailerHero(
  candidates: TrendingTitle[],
  trailers: readonly TrailerPick[],
  now: number,
): Campaign | null {
  if (candidates.length === 0 || trailers.length === 0) return null;
  const byId = new Map(candidates.map((t) => [t.id, t]));

  let best: { title: TrendingTitle; pick: TrailerPick; at: number } | null = null;
  for (const pick of trailers) {
    const title = byId.get(pick.titleId);
    if (!title) continue;
    const at = Date.parse(pick.publishedAt);
    if (Number.isNaN(at)) continue;
    const ageHours = (now - at) / 3_600_000;
    // Future-dated stamps are bad data; treat them as age 0 rather than letting a
    // typo'd year win forever.
    if (ageHours > TRAILER_HERO_MAX_AGE_HOURS) continue;
    if (best === null || at > best.at) best = { title, pick, at };
  }
  if (!best) return null;

  const label = best.pick.videoType === 'Teaser' ? 'New Teaser' : 'New Trailer';
  return campaignFromTitle(best.title, label, best.title.trailer_key);
}

/** One TrendingTitle → the auto-hero Campaign shape. `label` overrides the
 *  contextual badge when the news itself is the label. */
function campaignFromTitle(
  t: TrendingTitle,
  label: string | null,
  trailerKey: string | null,
): Campaign {
  return {
    id: `auto:${t.id}`,
    label: label ?? trendingBadge(t)?.label ?? 'Trending Now',
    headline: t.title,
    blurb: firstSentence(t.overview),
    accent: null, // UI defaults to the brand orange
    backdrop_url: t.backdrop_url,
    poster_url: t.poster_url,
    title_id: t.id,
    trailer_key: trailerKey,
    characters: t.characters,
  };
}

/** First sentence of a TMDB synopsis, capped — keeps the auto-blurb to one tidy
 *  line instead of dumping a full paragraph. */
function firstSentence(text: string | null): string | null {
  const trimmed = text?.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^.*?[.!?](?=\s|$)/);
  const sentence = (match ? match[0] : trimmed).trim();
  return sentence.length > 160 ? `${sentence.slice(0, 157).trimEnd()}…` : sentence;
}

// ── Personalized trending (Phase 3) ──────────────────────────────────────────

/** Characters from the current film/TV window that share a publisher or franchise
 *  with what the user has favourited or recently viewed. Empty for signed-out or
 *  affinity-less users (the caller hides the row). */
export async function getTrendingForUser(
  userId: string,
  limit = 20,
): Promise<TrendingTitleCharacter[]> {
  const { data, error } = await supabase.rpc('get_trending_for_user', {
    p_user_id: userId,
    p_limit: limit,
  });
  if (error) {
    console.warn('[getTrendingForUser] error:', error.message);
    return [];
  }
  return (
    (data ?? []) as (Omit<TrendingTitleCharacter, 'avatar_url'> & {
      avatar_url?: string | null;
    })[]
  ).map((r) => ({
    id: r.id,
    name: r.name,
    image_url: r.image_url,
    portrait_url: r.portrait_url,
    // This path comes from a different RPC that doesn't select it; the head is
    // simply absent here rather than wrongly assumed.
    avatar_url: r.avatar_url ?? null,
  }));
}

/** A short meta line for a trending title — provider, upcoming date, or year. */
export function trendingTitleMeta(t: TrendingTitle): string | null {
  if (t.provider) return `On ${t.provider}`;
  if (t.release_date) {
    const d = new Date(t.release_date);
    if (Number.isNaN(d.getTime())) return null;
    if (d.getTime() > Date.now()) {
      return `Coming ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`;
    }
    return String(d.getUTCFullYear());
  }
  return null;
}

/** Merge the three trending buckets into one ordered, de-duplicated list —
 *  theatrical first, then upcoming, then streaming — so "On Screen Now" is a
 *  single calm rail whose per-title badge carries the distinction. */
export function mergeTrendingTitles(
  onScreen: TrendingTitle[],
  comingSoon: TrendingTitle[],
  streaming: TrendingTitle[],
  cap = 12,
): TrendingTitle[] {
  const seen = new Set<string>();
  const out: TrendingTitle[] = [];
  for (const t of [...onScreen, ...comingSoon, ...streaming]) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(t);
    if (out.length >= cap) break;
  }
  return out;
}

// ── Contextual badges (Phase 5) ──────────────────────────────────────────────
// The card's "why": in theaters, new on a streamer, or coming soon. Tone keys a
// colour in the UI so a card reads its status at a glance.
export type BadgeTone = 'theaters' | 'streaming' | 'coming';
export interface TrendingBadge {
  tone: BadgeTone;
  label: string;
}

export function trendingBadge(
  t: Pick<TrendingTitle, 'provider' | 'release_date'>,
): TrendingBadge | null {
  if (t.release_date) {
    const d = new Date(t.release_date);
    if (!Number.isNaN(d.getTime()) && d.getTime() > Date.now()) {
      return {
        tone: 'coming',
        label: `Coming ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`,
      };
    }
  }
  if (t.provider) {
    const short =
      t.provider.length <= 16 ? t.provider : t.provider.split(' ').slice(0, 2).join(' ');
    return { tone: 'streaming', label: short };
  }
  if (t.release_date) return { tone: 'theaters', label: 'In Theaters' };
  return null;
}

export interface WikiTrendingHero {
  id: string;
  name: string;
  image_url: string | null;
  portrait_url: string | null;
  /** Flat head icon — famous tier only, so every consumer must degrade. */
  avatar_url: string | null;
  /** Pageviews in the most recent 7 days. */
  week: number;
  /** Week-over-week growth as a percentage (spike ratio 2.8 → 180). */
  spikePct: number;
}

export interface WikiTrendingRow {
  id: string;
  name: string;
  image_url: string | null;
  portrait_url: string | null;
  pageviews_week: number | null;
  pageviews_spike: number | string | null;
  avatar_url?: string | null;
}

/** Flat RPC rows → WikiTrendingHero. Shared with the explore-bundle path. */
export function mapWikiTrendingRows(rows: WikiTrendingRow[]): WikiTrendingHero[] {
  return rows.map((r) => {
    const spike =
      typeof r.pageviews_spike === 'string'
        ? parseFloat(r.pageviews_spike)
        : (r.pageviews_spike ?? 1);
    return {
      id: r.id,
      name: r.name,
      image_url: r.image_url,
      portrait_url: r.portrait_url,
      // Optional at the row level because the explore-bundle path that shares
      // this mapper predates the column.
      avatar_url: r.avatar_url ?? null,
      week: r.pageviews_week ?? 0,
      spikePct: Math.max(0, Math.round((spike - 1) * 100)),
    };
  });
}

/** Characters whose Wikipedia pageviews spiked this week. Degrades to [] so a DB
 *  hiccup never errors the Explore band. */
export async function getTrendingHeroesWiki(limit = 12): Promise<WikiTrendingHero[]> {
  const { data, error } = await supabase.rpc('get_trending_heroes_wiki', {
    p_limit: limit,
  } as never);
  if (error) {
    console.warn('[getTrendingHeroesWiki] error:', error.message);
    return [];
  }
  return mapWikiTrendingRows((data ?? []) as unknown as WikiTrendingRow[]);
}
