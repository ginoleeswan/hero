// src/lib/tmdb/mapVideos.ts — TMDB `videos.results` → persistable rows.
//
// The enrichment pipeline has always fetched these (every title request carries
// `append_to_response=videos`) and kept exactly one field: the YouTube key of the
// first trailer. Everything else was dropped on the floor — including
// `published_at`, which is the only "a trailer just dropped" timestamp available
// anywhere in the stack. Persisting the rest costs no additional API calls.
//
// Read defensively. `site`, `type` and `key` are confirmed by working production
// code (enrich-tmdb-batch has filtered on `v.type === 'Trailer'` for months and
// trailers do land), but `published_at` and `official` come from TMDB's
// documented schema and have never been observed in this codebase. So a missing
// or unparseable field yields null and a counted warning rather than a throw —
// a naming surprise degrades to "no timestamps" instead of breaking enrichment.
//
// Mirrored by supabase/functions/_shared — see mapVideoRows' callers.

/** A row of `public.title_videos`, keyed by TMDB's own video id. */
export interface TitleVideo {
  /** TMDB's video id — stable, and distinct from `key`. */
  id: string;
  title_id: string;
  /** The YouTube (or Vimeo) id — what an embed actually needs. */
  key: string;
  site: string | null;
  /** Trailer / Teaser / Clip / Featurette / Behind the Scenes / Bloopers. */
  type: string | null;
  name: string | null;
  official: boolean | null;
  /** ISO-8601. Null when TMDB omitted it or it didn't parse. */
  published_at: string | null;
  size: number | null;
  language: string | null;
}

export interface MapVideosResult {
  rows: TitleVideo[];
  /** Videos skipped for want of an id or key — they'd be unrenderable. */
  skipped: number;
  /** Rows that parsed but carry no usable `published_at`. A non-zero count here
   *  across the whole catalogue is the signal that the documented field name is
   *  wrong; the caller logs it rather than failing. */
  undated: number;
}

/** The video types worth treating as a "new trailer" event. Clips, featurettes
 *  and bloopers are real videos but they aren't news. */
export const EVENT_VIDEO_TYPES: readonly string[] = ['Trailer', 'Teaser'];

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : null;

const bool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);

const int = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : null;

/** TMDB publishes `"2016-03-05T02:03:14.000Z"`. Normalise to ISO-8601 UTC, or
 *  null if it's absent or nonsense — never a NaN date. */
export function parsePublishedAt(v: unknown): string | null {
  const raw = str(v);
  if (!raw) return null;
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) return null;
  // A timestamp before YouTube existed, or in the far future, is bad data rather
  // than a real publish date.
  const year = new Date(ms).getUTCFullYear();
  if (year < 2005 || year > 2100) return null;
  return new Date(ms).toISOString();
}

/**
 * Map one title's `videos.results` into persistable rows. Order is preserved —
 * TMDB returns roughly newest-first and callers may rely on it for tie-breaks.
 * Duplicate ids are collapsed, keeping the first occurrence.
 */
export function mapVideoRows(titleId: string, results: unknown): MapVideosResult {
  if (!Array.isArray(results)) return { rows: [], skipped: 0, undated: 0 };

  const rows: TitleVideo[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  let undated = 0;

  for (const raw of results) {
    if (typeof raw !== 'object' || raw === null) {
      skipped++;
      continue;
    }
    const v = raw as Record<string, unknown>;
    const id = str(v.id);
    const key = str(v.key);
    // Without an id there's no stable primary key, and without a key there's
    // nothing to play. Either way the row is useless.
    if (!id || !key) {
      skipped++;
      continue;
    }
    if (seen.has(id)) continue;
    seen.add(id);

    const published_at = parsePublishedAt(v.published_at);
    if (!published_at) undated++;

    rows.push({
      id,
      title_id: titleId,
      key,
      site: str(v.site),
      type: str(v.type),
      name: str(v.name),
      official: bool(v.official),
      published_at,
      size: int(v.size),
      language: str(v.iso_639_1),
    });
  }

  return { rows, skipped, undated };
}

/**
 * The key the existing pipeline stores on `titles.trailer_key`. Reproduces the
 * incumbent precedence exactly — first YouTube `Trailer`, else first YouTube
 * anything — so persisting the full list can't quietly change which trailer the
 * rest of the app already plays.
 */
export function pickTrailerKey(rows: TitleVideo[]): string | null {
  const youtube = rows.filter((r) => r.site === 'YouTube');
  return (youtube.find((r) => r.type === 'Trailer') ?? youtube[0])?.key ?? null;
}

/** Newest event-worthy video, by `published_at`. Undated rows can't be news, so
 *  they're excluded rather than sorted to one end. */
export function newestEventVideo(rows: TitleVideo[]): TitleVideo | null {
  const dated = rows.filter(
    (r) => r.published_at !== null && r.type !== null && EVENT_VIDEO_TYPES.includes(r.type),
  );
  if (dated.length === 0) return null;
  return dated.reduce((best, r) =>
    Date.parse(r.published_at as string) > Date.parse(best.published_at as string) ? r : best,
  );
}
