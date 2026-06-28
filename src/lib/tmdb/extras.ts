// Pure builder: the extra TMDB detail fields (beyond the core media columns)
// that get stored in the titles.details jsonb bag. Shared by mapFilm/mapTv and
// MIRRORED inside the enrich-tmdb-batch edge function — keep the two in sync.
//
// Fetched via append_to_response=...,recommendations,reviews,external_ids,
// keywords,release_dates (movie) / content_ratings (tv).

const IMG = 'https://image.tmdb.org/t/p';
const img = (path: string | null | undefined, size: string): string | null =>
  path ? `${IMG}/${size}${path}` : null;
const yearOf = (date: string | null | undefined): number | null => {
  const y = date ? parseInt(date.slice(0, 4), 10) : NaN;
  return Number.isFinite(y) ? y : null;
};

export interface TitleRecommendation {
  id: string; // composite title id, e.g. 'tmdb:557'
  title: string;
  posterUrl: string | null;
  year: number | null;
}

export interface TitleReview {
  author: string;
  rating: number | null;
  content: string;
  url: string | null;
}

export interface TitleExternalIds {
  imdb: string | null;
  instagram: string | null;
  twitter: string | null;
  facebook: string | null;
  homepage: string | null;
}

export interface TitleCollection {
  id: string; // 'tmdb-collection:<id>'
  name: string;
  posterUrl: string | null;
}

export interface TitleExtras {
  genres: string[] | null;
  tagline: string | null;
  certification: string | null;
  director: string | null;
  writers: string[] | null;
  keywords: string[] | null;
  externalIds: TitleExternalIds | null;
  recommendations: TitleRecommendation[] | null;
  reviews: TitleReview[] | null;
  // Broader catalogue metadata — stored so we have it, surfaced as needed.
  status: string | null;
  budget: number | null;
  originalLanguage: string | null;
  spokenLanguages: string[] | null;
  productionCompanies: string[] | null;
  productionCountries: string[] | null;
  voteCount: number | null;
  collection: TitleCollection | null;
}

// Loose shape of the relevant slices of a TMDB detail response.
export interface ExtrasInput {
  tagline?: string | null;
  homepage?: string | null;
  status?: string | null;
  budget?: number | null;
  vote_count?: number | null;
  original_language?: string | null;
  spoken_languages?: { english_name?: string | null; name?: string | null }[];
  production_companies?: { name?: string | null }[];
  production_countries?: { name?: string | null }[];
  belongs_to_collection?: { id?: number; name?: string | null; poster_path?: string | null } | null;
  genres?: { name?: string | null }[];
  credits?: { crew?: { job?: string | null; name?: string | null }[] };
  created_by?: { name?: string | null }[];
  keywords?: {
    keywords?: { name?: string | null }[]; // movie
    results?: { name?: string | null }[]; // tv
  };
  external_ids?: {
    imdb_id?: string | null;
    instagram_id?: string | null;
    twitter_id?: string | null;
    facebook_id?: string | null;
  };
  release_dates?: {
    results?: { iso_3166_1?: string; release_dates?: { certification?: string }[] }[];
  };
  content_ratings?: { results?: { iso_3166_1?: string; rating?: string }[] };
  recommendations?: {
    results?: {
      id: number;
      title?: string;
      name?: string;
      poster_path?: string | null;
      release_date?: string | null;
      first_air_date?: string | null;
    }[];
  };
  reviews?: {
    results?: {
      author?: string;
      content?: string;
      url?: string | null;
      author_details?: { rating?: number | null };
    }[];
  };
}

const REC_CAP = 12;
const REVIEW_CAP = 5;
const KEYWORD_CAP = 15;
const WRITER_JOBS = new Set(['Writer', 'Screenplay', 'Story']);

function movieCertification(input: ExtrasInput): string | null {
  const us = input.release_dates?.results?.find((r) => r.iso_3166_1 === 'US');
  const cert = us?.release_dates?.map((d) => d.certification).find((c) => c && c.trim());
  return cert ?? null;
}

function tvCertification(input: ExtrasInput): string | null {
  const us = input.content_ratings?.results?.find((r) => r.iso_3166_1 === 'US');
  return us?.rating?.trim() ? us.rating : null;
}

const orNull = <T>(arr: T[]): T[] | null => (arr.length > 0 ? arr : null);

/** Build the details extras bag from a TMDB detail response. */
export function buildTitleExtras(input: ExtrasInput, kind: 'movie' | 'tv'): TitleExtras {
  const genres = (input.genres ?? [])
    .map((g) => g.name)
    .filter((n): n is string => !!n && n.trim().length > 0);

  const crew = input.credits?.crew ?? [];
  const director = kind === 'movie' ? (crew.find((c) => c.job === 'Director')?.name ?? null) : null;
  const writers =
    kind === 'tv'
      ? (input.created_by ?? []).map((c) => c.name).filter((n): n is string => !!n)
      : Array.from(
          new Set(
            crew
              .filter((c) => c.job && WRITER_JOBS.has(c.job))
              .map((c) => c.name)
              .filter((n): n is string => !!n),
          ),
        ).slice(0, 3);

  const kwSource = kind === 'movie' ? input.keywords?.keywords : input.keywords?.results;
  const keywords = (kwSource ?? [])
    .map((k) => k.name)
    .filter((n): n is string => !!n)
    .slice(0, KEYWORD_CAP);

  const certification = kind === 'movie' ? movieCertification(input) : tvCertification(input);

  const ext = input.external_ids;
  const externalIds: TitleExternalIds = {
    imdb: ext?.imdb_id ?? null,
    instagram: ext?.instagram_id ?? null,
    twitter: ext?.twitter_id ?? null,
    facebook: ext?.facebook_id ?? null,
    homepage: input.homepage?.trim() ? input.homepage : null,
  };
  const hasExternal = Object.values(externalIds).some((v) => v !== null);

  const recommendations = (input.recommendations?.results ?? [])
    .slice(0, REC_CAP)
    .map((r) => ({
      id: `tmdb:${r.id}`,
      title: (r.title ?? r.name ?? '').trim(),
      posterUrl: img(r.poster_path, 'w342'),
      year: yearOf(r.release_date ?? r.first_air_date),
    }))
    .filter((r) => r.title.length > 0);

  const reviews = (input.reviews?.results ?? [])
    .slice(0, REVIEW_CAP)
    .map((r) => ({
      author: (r.author ?? 'Anonymous').trim(),
      rating: typeof r.author_details?.rating === 'number' ? r.author_details.rating : null,
      content: (r.content ?? '').trim(),
      url: r.url ?? null,
    }))
    .filter((r) => r.content.length > 0);

  const spokenLanguages = (input.spoken_languages ?? [])
    .map((l) => l.english_name ?? l.name)
    .filter((n): n is string => !!n);
  const productionCompanies = (input.production_companies ?? [])
    .map((c) => c.name)
    .filter((n): n is string => !!n);
  const productionCountries = (input.production_countries ?? [])
    .map((c) => c.name)
    .filter((n): n is string => !!n);

  const col = input.belongs_to_collection;
  const collection: TitleCollection | null =
    col && col.id && col.name
      ? { id: `tmdb-collection:${col.id}`, name: col.name, posterUrl: img(col.poster_path, 'w342') }
      : null;

  return {
    genres: orNull(genres),
    tagline: input.tagline?.trim() ? input.tagline : null,
    certification,
    director,
    writers: orNull(writers),
    keywords: orNull(keywords),
    externalIds: hasExternal ? externalIds : null,
    recommendations: orNull(recommendations),
    reviews: orNull(reviews),
    status: input.status?.trim() ? input.status : null,
    budget: typeof input.budget === 'number' && input.budget > 0 ? input.budget : null,
    originalLanguage: input.original_language?.trim() ? input.original_language : null,
    spokenLanguages: orNull(spokenLanguages),
    productionCompanies: orNull(productionCompanies),
    productionCountries: orNull(productionCountries),
    voteCount: typeof input.vote_count === 'number' ? input.vote_count : null,
    collection,
  };
}
