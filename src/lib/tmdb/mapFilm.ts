// Pure mapper: TMDB /movie/{id}?append_to_response=videos,watch/providers,
// credits,images  →  a films table row. jest-testable; mirrored (kept in sync)
// inside the enrich-tmdb-batch edge function.

const IMG = 'https://image.tmdb.org/t/p';
const img = (path: string | null | undefined, size: string): string | null =>
  path ? `${IMG}/${size}${path}` : null;

interface TmdbVideo {
  site: string;
  type: string;
  key: string;
}
interface TmdbCastMember {
  name: string;
  character?: string;
  profile_path: string | null;
}

export interface TmdbDetails {
  id: number;
  title: string;
  release_date: string | null;
  overview?: string | null;
  vote_average?: number | null;
  popularity?: number | null;
  runtime?: number | null;
  revenue?: number | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  videos?: { results?: TmdbVideo[] };
  'watch/providers'?: { results?: Record<string, unknown> };
  credits?: { cast?: TmdbCastMember[] };
  images?: { backdrops?: { file_path: string }[] };
}

export interface FilmRow {
  tmdb_id: string;
  title: string;
  release_date: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  overview: string | null;
  vote_average: number | null;
  popularity: number | null;
  runtime: number | null;
  revenue: number | null;
  trailer_key: string | null;
  watch_providers: Record<string, unknown> | null;
  cast_members: { name: string; character: string | null; profile_url: string | null }[] | null;
  stills: string[] | null;
}

const CAST_CAP = 10;
const STILLS_CAP = 8;

export function mapTmdbDetailsToFilm(d: TmdbDetails): FilmRow {
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

  return {
    tmdb_id: String(d.id),
    title: d.title,
    release_date: d.release_date ?? null,
    poster_url: img(d.poster_path, 'w500'),
    backdrop_url: img(d.backdrop_path, 'w1280'),
    overview: d.overview?.trim() ? d.overview : null,
    vote_average: typeof d.vote_average === 'number' ? d.vote_average : null,
    popularity: typeof d.popularity === 'number' ? d.popularity : null,
    runtime: typeof d.runtime === 'number' ? d.runtime : null,
    revenue: typeof d.revenue === 'number' && d.revenue > 0 ? d.revenue : null,
    trailer_key: trailer?.key ?? null,
    watch_providers: providers && Object.keys(providers).length > 0 ? providers : null,
    cast_members: cast && cast.length > 0 ? cast : null,
    stills: stills && stills.length > 0 ? stills : null,
  };
}
