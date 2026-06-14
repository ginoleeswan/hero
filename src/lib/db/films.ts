import { supabase } from '../supabase';

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
}

interface JoinRow {
  rank: number | null;
  films: {
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
  } | null;
}

/** Films a hero appears in, richest-first (by appearance rank = issue_count). */
export async function getHeroFilms(heroId: string): Promise<HeroFilm[]> {
  const { data, error } = await supabase
    .from('hero_film_appearances')
    .select(
      'rank, films ( tmdb_id, title, year, poster_url, backdrop_url, vote_average, runtime, overview, trailer_key, watch_providers, cast_members, stills )',
    )
    .eq('hero_id', heroId)
    .order('rank', { ascending: false, nullsFirst: false });

  if (error || !data) return [];

  return (data as unknown as JoinRow[])
    .filter((r) => r.films !== null)
    .map((r) => {
      const f = r.films!;
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
      };
    });
}
