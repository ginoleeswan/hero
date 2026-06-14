import { supabase } from '../supabase';
import type { RelatedHeroCard } from './heroes';

export interface HeroFilmCastMember {
  name: string;
  character: string | null;
  profile_url: string | null;
}

export interface HeroFilm {
  tmdbId: string;
  title: string;
  year: number | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  voteAverage: number | null;
  runtime: number | null;
  overview: string | null;
  trailerKey: string | null;
  watchProviders: Record<string, unknown> | null;
  cast: HeroFilmCastMember[] | null;
  stills: string[] | null;
  revenue: number | null;
}

export interface WatchProvider {
  name: string;
  logoUrl: string | null;
}

const TMDB_LOGO_BASE = 'https://image.tmdb.org/t/p/w92';

/** Extract watch providers from the raw TMDB `results` blob.
 *  Prefers US region, falls back to first available region.
 *  Pulls from flatrate, rent, buy arrays; dedupes by provider_name. */
export function extractProviders(blob: Record<string, unknown> | null): WatchProvider[] {
  if (!blob) return [];
  // Prefer US; fall back to first available region.
  const regionData =
    (blob['US'] as Record<string, unknown> | undefined) ??
    Object.values(blob).find(
      (v): v is Record<string, unknown> => typeof v === 'object' && v !== null,
    );
  if (!regionData) return [];

  const seen = new Map<string, WatchProvider>();
  for (const key of ['flatrate', 'rent', 'buy'] as const) {
    const arr = regionData[key];
    if (!Array.isArray(arr)) continue;
    for (const p of arr) {
      if (typeof p !== 'object' || p === null) continue;
      const row = p as Record<string, unknown>;
      const name = typeof row['provider_name'] === 'string' ? row['provider_name'] : null;
      if (!name || seen.has(name)) continue;
      const logoPath = typeof row['logo_path'] === 'string' ? row['logo_path'] : null;
      seen.set(name, { name, logoUrl: logoPath ? TMDB_LOGO_BASE + logoPath : null });
    }
  }
  return Array.from(seen.values());
}

/**
 * Pick the strongest film to feature: the highest-rated title that has a
 * backdrop (a backdrop implies a real theatrical/streaming release, and the
 * rating keeps the banner from leading with an obscure low-rated entry). Falls
 * back to the highest-rated overall, then the first film.
 */
export function pickFeaturedFilm(films: HeroFilm[]): HeroFilm | null {
  if (films.length === 0) return null;
  const withBackdrop = films.filter((f) => !!f.backdropUrl);
  const pool = withBackdrop.length > 0 ? withBackdrop : films;
  return pool.reduce(
    (best, f) => ((f.voteAverage ?? 0) > (best.voteAverage ?? 0) ? f : best),
    pool[0],
  );
}

interface FilmRow {
  tmdb_id: string;
  title: string;
  year: number | null;
  poster_url: string | null;
  backdrop_url: string | null;
  vote_average: number | null;
  runtime: number | null;
  overview: string | null;
  trailer_key: string | null;
  watch_providers: Record<string, unknown> | null;
  cast_members: HeroFilmCastMember[] | null;
  stills: string[] | null;
  revenue: number | null;
}

function filmRowToHeroFilm(f: FilmRow): HeroFilm {
  return {
    tmdbId: f.tmdb_id,
    title: f.title,
    year: f.year,
    posterUrl: f.poster_url,
    backdropUrl: f.backdrop_url,
    voteAverage: f.vote_average,
    runtime: f.runtime,
    overview: f.overview,
    trailerKey: f.trailer_key,
    watchProviders: f.watch_providers,
    cast: f.cast_members,
    stills: f.stills,
    revenue: f.revenue,
  };
}

interface JoinRow {
  rank: number | null;
  films: FilmRow | null;
}

const FILM_SELECT =
  'tmdb_id, title, year, poster_url, backdrop_url, vote_average, runtime, overview, trailer_key, watch_providers, cast_members, stills, revenue';

/** Films a hero appears in, richest-first (by appearance rank = issue_count). */
export async function getHeroFilms(heroId: string): Promise<HeroFilm[]> {
  const { data, error } = await supabase
    .from('hero_film_appearances')
    .select(`rank, films ( ${FILM_SELECT} )`)
    .eq('hero_id', heroId)
    .order('rank', { ascending: false, nullsFirst: false });

  if (error || !data) return [];

  return (data as unknown as JoinRow[])
    .filter((r) => r.films !== null)
    .map((r) => filmRowToHeroFilm(r.films!));
}

/** Fetch a single film by TMDB ID. Returns null on error or not found. */
export async function getFilmById(tmdbId: string): Promise<HeroFilm | null> {
  const { data, error } = await supabase
    .from('films')
    .select(FILM_SELECT)
    .eq('tmdb_id', tmdbId)
    .single();

  if (error || !data) return null;
  return filmRowToHeroFilm(data as unknown as FilmRow);
}

/** Heroes that appear in a film, ordered by appearance rank desc. */
export async function getFilmHeroes(tmdbId: string): Promise<RelatedHeroCard[]> {
  const { data, error } = await supabase
    .from('hero_film_appearances')
    .select('heroes ( id, name, image_url, image_md_url, portrait_url, publisher, alignment )')
    .eq('tmdb_id', tmdbId)
    .order('rank', { ascending: false, nullsFirst: false })
    .limit(30);

  if (error || !data) return [];

  return (data as unknown as Array<{ heroes: RelatedHeroCard | null }>)
    .filter((r) => r.heroes !== null)
    .map((r) => r.heroes!);
}
