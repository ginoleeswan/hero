// Pure mapper: TMDB /tv/{id}?append_to_response=videos,watch/providers,credits,
// images  →  a titles table row (media_type='tv'). jest-testable; mirrored
// (kept in sync) inside the enrich-tmdb-batch edge function.

const IMG = 'https://image.tmdb.org/t/p';
const img = (path: string | null | undefined, size: string): string | null =>
  path ? `${IMG}/${size}${path}` : null;

interface TmdbVideo { site: string; type: string; key: string }
interface TmdbCastMember { name: string; character?: string; profile_path: string | null }

export interface TmdbTvDetails {
  id: number;
  name: string;
  first_air_date?: string | null;
  overview?: string | null;
  vote_average?: number | null;
  number_of_seasons?: number | null;
  number_of_episodes?: number | null;
  episode_run_time?: number[] | null;
  networks?: { name: string }[] | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  videos?: { results?: TmdbVideo[] };
  'watch/providers'?: { results?: Record<string, unknown> };
  credits?: { cast?: TmdbCastMember[] };
  images?: { backdrops?: { file_path: string }[] };
}

export interface TvDetails {
  seasons: number | null;
  episodes: number | null;
  episode_runtime: number | null;
  networks: string[] | null;
}

export interface TvRow {
  title: string;
  release_date: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  overview: string | null;
  vote_average: number | null;
  trailer_key: string | null;
  watch_providers: Record<string, unknown> | null;
  cast_members: { name: string; character: string | null; profile_url: string | null }[] | null;
  stills: string[] | null;
  details: TvDetails;
}

const CAST_CAP = 10;
const STILLS_CAP = 8;

export function mapTmdbDetailsToTv(d: TmdbTvDetails): TvRow {
  const trailer =
    d.videos?.results?.find((v) => v.site === 'YouTube' && v.type === 'Trailer') ??
    d.videos?.results?.find((v) => v.site === 'YouTube');

  const cast = d.credits?.cast?.slice(0, CAST_CAP).map((c) => ({
    name: c.name,
    character: c.character?.trim() ? c.character : null,
    profile_url: img(c.profile_path, 'w185'),
  }));

  const stills = d.images?.backdrops
    ?.slice(0, STILLS_CAP)
    .map((b) => img(b.file_path, 'w780'))
    .filter((u): u is string => u !== null);

  const providers = d['watch/providers']?.results ?? null;
  const networks = d.networks?.map((n) => n.name).filter(Boolean) ?? null;

  return {
    title: d.name,
    release_date: d.first_air_date ?? null,
    poster_url: img(d.poster_path, 'w500'),
    backdrop_url: img(d.backdrop_path, 'w1280'),
    overview: d.overview?.trim() ? d.overview : null,
    vote_average: typeof d.vote_average === 'number' ? d.vote_average : null,
    trailer_key: trailer?.key ?? null,
    watch_providers: providers && Object.keys(providers).length > 0 ? providers : null,
    cast_members: cast && cast.length > 0 ? cast : null,
    stills: stills && stills.length > 0 ? stills : null,
    details: {
      seasons: typeof d.number_of_seasons === 'number' ? d.number_of_seasons : null,
      episodes: typeof d.number_of_episodes === 'number' ? d.number_of_episodes : null,
      episode_runtime: Array.isArray(d.episode_run_time) && d.episode_run_time.length > 0 ? d.episode_run_time[0] : null,
      networks: networks && networks.length > 0 ? networks : null,
    },
  };
}
