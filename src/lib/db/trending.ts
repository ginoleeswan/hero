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
}

export interface TrendingTitle {
  id: string;
  title: string;
  media_type: string | null;
  release_date: string | null;
  backdrop_url: string | null;
  poster_url: string | null;
  provider: string | null;
  /** TMDB synopsis — used as the auto-hero blurb. */
  overview: string | null;
  /** YouTube trailer key — present on trending-on-screen rows for a ▶ affordance. */
  trailer_key: string | null;
  characters: TrendingTitleCharacter[];
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
  // Flat rows (title fields repeated per character) → grouped titles, preserving
  // the RPC's order (titles by rank, characters by fame within each title).
  const byTitle = new Map<string, TrendingTitle>();
  for (const r of (data ?? []) as {
    title_id: string;
    title: string;
    media_type: string | null;
    release_date: string | null;
    backdrop_url: string | null;
    poster_url: string | null;
    provider: string | null;
    overview: string | null;
    hero_id: string;
    hero_name: string;
    hero_image_url: string | null;
    hero_portrait_url: string | null;
  }[]) {
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
    });
  }
  return [...byTitle.values()];
}

interface TrendingOnScreenRow {
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
  const { data, error } = await supabase.rpc('get_trending_on_screen' as never, { p_limit: limit } as never);
  if (error) {
    console.warn('[getTrendingOnScreen] error:', error.message);
    return [];
  }
  const byId = new Map<string, TrendingTitle>();
  for (const r of (data ?? []) as unknown as TrendingOnScreenRow[]) {
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
  characters: TrendingTitleCharacter[];
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
  const byId = new Map<string, Campaign>();
  for (const r of (data ?? []) as {
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
  }[]) {
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
        characters: [],
      };
      byId.set(r.campaign_id, c);
    }
    c.characters.push({
      id: r.hero_id,
      name: r.hero_name,
      image_url: r.hero_image_url,
      portrait_url: r.hero_portrait_url,
    });
  }
  const manual = [...byId.values()];
  if (manual.length > 0) return manual;

  // No editorial campaign live → auto-generate the hero from the trending slate so
  // the band is never stale or empty without anyone curating it. Random pick from
  // the popularity+character-gated pool (the RPC only surfaces titles that have
  // catalogue characters) keeps it fresh on refresh / return visits but relevant.
  // On-screen leads; fall back to streaming when nothing is in cinemas.
  const auto = await synthesizeCampaignFromTrending();
  return auto ? [auto] : [];
}

/** Build a one-off Campaign from a random popular trending title — the automatic
 *  fallback for the "Right Now" hero when no editorial campaign is scheduled. */
async function synthesizeCampaignFromTrending(): Promise<Campaign | null> {
  const usable = (ts: TrendingTitle[]) =>
    ts.filter((t) => t.backdrop_url && t.characters.length > 0);
  let pool = usable(await getTrendingTitles('on_screen', 8));
  if (pool.length === 0) pool = usable(await getTrendingTitles('streaming', 8));
  if (pool.length === 0) return null;
  const t = pool[Math.floor(Math.random() * pool.length)];
  const badge = trendingBadge(t);
  return {
    id: `auto:${t.id}`,
    label: badge?.label ?? 'Trending Now',
    headline: t.title,
    blurb: firstSentence(t.overview),
    accent: null, // UI defaults to the brand orange
    backdrop_url: t.backdrop_url,
    poster_url: t.poster_url,
    title_id: t.id,
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
  return ((data ?? []) as TrendingTitleCharacter[]).map((r) => ({
    id: r.id,
    name: r.name,
    image_url: r.image_url,
    portrait_url: r.portrait_url,
  }));
}

/** A short meta line for a trending title — provider, upcoming date, or year. */
export function trendingTitleMeta(t: TrendingTitle): string | null {
  if (t.provider) return `On ${t.provider}`;
  if (t.release_date) {
    const d = new Date(t.release_date);
    if (Number.isNaN(d.getTime())) return null;
    if (d.getTime() > Date.now()) {
      return `Coming ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
    return String(d.getFullYear());
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
        label: `Coming ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
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
