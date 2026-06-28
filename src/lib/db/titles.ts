import { supabase } from '../supabase';
import type { RelatedHeroCard } from './heroes';

export type MediaType = 'film' | 'tv' | 'game';
export type TitleSource = 'tmdb' | 'igdb';

export interface HeroTitleCastMember {
  name: string;
  character: string | null;
  profile_url: string | null;
}

export interface HeroTitle {
  id: string; // '<source>:<external_id>', e.g. 'tmdb:603'
  source: TitleSource;
  mediaType: MediaType;
  externalId: string;
  title: string;
  year: number | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  voteAverage: number | null;
  runtime: number | null;
  overview: string | null;
  trailerKey: string | null;
  watchProviders: Record<string, unknown> | null;
  cast: HeroTitleCastMember[] | null;
  stills: string[] | null;
  revenue: number | null;
  details: Record<string, unknown> | null;
}

export type WatchKind = 'flatrate' | 'rent' | 'buy';

export interface WatchProvider {
  name: string;
  logoUrl: string | null;
  kind: WatchKind;
}

export interface WatchInfo {
  /** TMDB/JustWatch region page where the user picks a provider. */
  link: string | null;
  providers: WatchProvider[];
}

export interface TitlesByMedia {
  film: HeroTitle[];
  tv: HeroTitle[];
  game: HeroTitle[];
}

export function buildTitleId(source: TitleSource, externalId: string): string {
  return `${source}:${externalId}`;
}

export function parseTitleId(id: string): { source: string; externalId: string } {
  const i = id.indexOf(':');
  return i === -1
    ? { source: id, externalId: '' }
    : { source: id.slice(0, i), externalId: id.slice(i + 1) };
}

/** Strongest title to feature: highest-rated with a backdrop, else highest-rated. */
export function pickFeaturedTitle(titles: HeroTitle[]): HeroTitle | null {
  if (titles.length === 0) return null;
  const withBackdrop = titles.filter((tt) => !!tt.backdropUrl);
  const pool = withBackdrop.length > 0 ? withBackdrop : titles;
  return pool.reduce(
    (best, tt) => ((tt.voteAverage ?? 0) > (best.voteAverage ?? 0) ? tt : best),
    pool[0],
  );
}

/** Split a flat title list into per-media-type buckets, preserving order. */
export function groupTitlesByMedia(titles: HeroTitle[]): TitlesByMedia {
  const out: TitlesByMedia = { film: [], tv: [], game: [] };
  for (const tt of titles) out[tt.mediaType].push(tt);
  return out;
}

const TMDB_LOGO_BASE = 'https://image.tmdb.org/t/p/w92';

/**
 * Watch providers from the raw TMDB blob: prefer US, dedupe by provider_name
 * (first hit wins, so flatrate beats rent beats buy), and surface the region
 * link. TMDB gives one link per region — not per provider.
 */
export function extractProviders(blob: Record<string, unknown> | null): WatchInfo {
  if (!blob) return { link: null, providers: [] };
  const regionData =
    (blob['US'] as Record<string, unknown> | undefined) ??
    Object.values(blob).find(
      (v): v is Record<string, unknown> => typeof v === 'object' && v !== null,
    );
  if (!regionData) return { link: null, providers: [] };
  const link = typeof regionData['link'] === 'string' ? regionData['link'] : null;
  const seen = new Map<string, WatchProvider>();
  for (const kind of ['flatrate', 'rent', 'buy'] as const) {
    const arr = regionData[kind];
    if (!Array.isArray(arr)) continue;
    for (const p of arr) {
      if (typeof p !== 'object' || p === null) continue;
      const row = p as Record<string, unknown>;
      const name = typeof row['provider_name'] === 'string' ? row['provider_name'] : null;
      if (!name || seen.has(name)) continue;
      const logoPath = typeof row['logo_path'] === 'string' ? row['logo_path'] : null;
      seen.set(name, { name, logoUrl: logoPath ? TMDB_LOGO_BASE + logoPath : null, kind });
    }
  }
  return { link, providers: Array.from(seen.values()) };
}

interface TitleRow {
  id: string;
  source: TitleSource;
  media_type: MediaType;
  external_id: string;
  title: string;
  year: number | null;
  poster_url: string | null;
  backdrop_url: string | null;
  vote_average: number | null;
  runtime: number | null;
  overview: string | null;
  trailer_key: string | null;
  watch_providers: Record<string, unknown> | null;
  cast_members: HeroTitleCastMember[] | null;
  stills: string[] | null;
  revenue: number | null;
  details: Record<string, unknown> | null;
}

const TITLE_SELECT =
  'id, source, media_type, external_id, title, year, poster_url, backdrop_url, vote_average, runtime, overview, trailer_key, watch_providers, cast_members, stills, revenue, details';

function titleRowToHeroTitle(r: TitleRow): HeroTitle {
  return {
    id: r.id,
    source: r.source,
    mediaType: r.media_type,
    externalId: r.external_id,
    title: r.title,
    year: r.year,
    posterUrl: r.poster_url,
    backdropUrl: r.backdrop_url,
    voteAverage: r.vote_average,
    runtime: r.runtime,
    overview: r.overview,
    trailerKey: r.trailer_key,
    watchProviders: r.watch_providers,
    cast: r.cast_members,
    stills: r.stills,
    revenue: r.revenue,
    details: r.details,
  };
}

interface JoinRow {
  rank: number | null;
  titles: TitleRow | null;
}

/** Titles a hero appears in, richest-first (rank = issue_count). */
export async function getHeroTitles(heroId: string): Promise<HeroTitle[]> {
  const { data, error } = await supabase
    .from('hero_media_appearances')
    .select(`rank, titles ( ${TITLE_SELECT} )`)
    .eq('hero_id', heroId)
    .order('rank', { ascending: false, nullsFirst: false });
  if (error || !data) return [];
  return (data as unknown as JoinRow[])
    .filter((r) => r.titles !== null)
    .map((r) => titleRowToHeroTitle(r.titles!));
}

/** A single title by composite id ('tmdb:603'). Null on error/not found. */
export async function getTitleById(id: string): Promise<HeroTitle | null> {
  const { data, error } = await supabase.from('titles').select(TITLE_SELECT).eq('id', id).single();
  if (error || !data) return null;
  return titleRowToHeroTitle(data as unknown as TitleRow);
}

const charNorm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Best catalog hero for a cast member's character string, or null. Matches the
 * hero name as a whole token inside the character ("Peter Parker / Spider-Man"
 * → "Spider-Man"); the longest match wins so "Spider-Man" beats "Man". Names
 * under 3 chars are ignored to avoid spurious hits.
 */
export function matchCharacterToHero(
  character: string | null,
  heroes: RelatedHeroCard[],
): RelatedHeroCard | null {
  if (!character) return null;
  const c = charNorm(character);
  if (!c) return null;
  const padded = ` ${c} `;
  let best: RelatedHeroCard | null = null;
  let bestLen = 0;
  for (const h of heroes) {
    const hn = charNorm(h.name);
    if (hn.length < 3) continue;
    if (c === hn) return h; // exact wins outright
    if (padded.includes(` ${hn} `) && hn.length > bestLen) {
      best = h;
      bestLen = hn.length;
    }
  }
  return best;
}

/** Heroes appearing in a title, ranked desc. */
export async function getTitleHeroes(id: string): Promise<RelatedHeroCard[]> {
  const { data, error } = await supabase
    .from('hero_media_appearances')
    .select('heroes ( id, name, image_url, image_md_url, portrait_url, publisher, alignment )')
    .eq('title_id', id)
    .order('rank', { ascending: false, nullsFirst: false })
    .limit(30);
  if (error || !data) return [];
  return (data as unknown as { heroes: RelatedHeroCard | null }[])
    .filter((r) => r.heroes !== null)
    .map((r) => r.heroes!);
}

export interface TitleSearchResult {
  id: string;
  title: string;
  media_type: string;
  year: number | null;
  poster_url: string | null;
}

/** A pooled title row with the signals used to rank prominence. */
export interface TitlePoolRow extends TitleSearchResult {
  revenue: number | string | null;
  popularity: number | string | null;
  vote_average: number | string | null;
}

const titleNorm = (s: string) => s.trim().toLowerCase();
const num = (v: number | string | null | undefined) => {
  const n = typeof v === 'string' ? parseFloat(v) : (v ?? 0);
  return Number.isFinite(n) ? (n as number) : 0;
};

/**
 * Prominence on a single scale across films AND tv: blockbuster revenue dominates
 * (so the icons win — revenue in $millions), but titles with no revenue (tv,
 * obscure) still rank via TMDB popularity or rating. TMDB `popularity` alone is a
 * volatile "trending now" signal that floats unreleased/obscure films above
 * classics — never order by it directly.
 */
function titleProminence(r: TitlePoolRow): number {
  return num(r.revenue) / 1_000_000 + num(r.popularity) * 0.3 + num(r.vote_average);
}

// A name-match nudge that lets a better match win between similarly-prominent
// titles, while a far-more-prominent title can still override one tier (a
// blockbuster "The Batman" beats an obscure prefix "Batman Ninja").
function titleTierBonus(title: string, q: string): number {
  const n = titleNorm(title);
  if (n === q) return 300;
  if (n.startsWith(q)) return 100;
  return 0;
}

/**
 * Re-rank an ILIKE title pool by a blend of name relevance + prominence, so the
 * canonical/blockbuster title wins. Pure + tested.
 */
export function rankTitles(rows: TitlePoolRow[], query: string): TitlePoolRow[] {
  const q = titleNorm(query);
  return rows
    .map((r, i) => ({ r, i, score: titleProminence(r) + titleTierBonus(r.title, q) }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((x) => x.r);
}

/** Most-prominent films/shows (by revenue) for the empty-search showcase. */
export async function getTrendingTitles(limit = 2): Promise<TitleSearchResult[]> {
  const { data, error } = await supabase
    .from('titles')
    .select('id, title, media_type, year, poster_url')
    .not('poster_url', 'is', null)
    .order('revenue', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) {
    console.warn('[getTrendingTitles] error:', error.message);
    return [];
  }
  return (data ?? []) as TitleSearchResult[];
}

/**
 * Title search for the unified search surface. Fetches a revenue-ordered ILIKE
 * pool (so the blockbusters are always in it), then re-ranks by relevance +
 * prominence and returns the lean rows. Empty query short-circuits; degrades to []
 * so a DB hiccup never blanks the other result sections.
 */
export async function searchTitles(query: string, limit = 6): Promise<TitleSearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const { data, error } = await supabase
    .from('titles')
    .select('id, title, media_type, year, poster_url, revenue, popularity, vote_average')
    .ilike('title', `%${q}%`)
    .order('revenue', { ascending: false, nullsFirst: false })
    .limit(60);
  if (error) {
    console.warn('[searchTitles] error:', error.message);
    return [];
  }
  return rankTitles((data ?? []) as TitlePoolRow[], q)
    .slice(0, limit)
    .map(({ id, title, media_type, year, poster_url }) => ({
      id,
      title,
      media_type,
      year,
      poster_url,
    }));
}
