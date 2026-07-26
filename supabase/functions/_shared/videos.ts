// supabase/functions/_shared/videos.ts — TMDB `videos.results` → title_videos rows.
//
// Mirror of src/lib/tmdb/mapVideos.ts. Deno can't import from src/, but it can
// share between functions, so both consumers — enrich-tmdb-batch (which already
// fetches videos as part of append_to_response) and sync-title-videos (the daily
// /videos sweep) — import this rather than carrying their own copy. Unit tests
// live against the TS original in __tests__/lib/tmdb/mapVideos.test.ts; change
// both files together.
//
// Read defensively: `site`, `type` and `key` are confirmed by working production
// code, but `published_at` and `official` come from TMDB's documented schema and
// have never been observed in this codebase. Missing or malformed fields yield
// null and a counted warning, never a throw — a naming surprise must degrade to
// "no timestamps", not break enrichment.

export interface TitleVideo {
  /** TMDB's own video id — stable, and distinct from `key`. */
  id: string;
  title_id: string;
  /** The YouTube (or Vimeo) id — what an embed needs. */
  key: string;
  site: string | null;
  /** Trailer / Teaser / Clip / Featurette / Behind the Scenes / Bloopers. */
  type: string | null;
  name: string | null;
  official: boolean | null;
  published_at: string | null;
  size: number | null;
  language: string | null;
}

export interface MapVideosResult {
  rows: TitleVideo[];
  /** Skipped for want of an id or key — unrenderable either way. */
  skipped: number;
  /** Parsed but with no usable `published_at`. */
  undated: number;
}

export const EVENT_VIDEO_TYPES: readonly string[] = ['Trailer', 'Teaser'];

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
const bool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);
const int = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : null;

export function parsePublishedAt(v: unknown): string | null {
  const raw = str(v);
  if (!raw) return null;
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) return null;
  // Pre-YouTube or far-future is bad data, not a publish date.
  const year = new Date(ms).getUTCFullYear();
  if (year < 2005 || year > 2100) return null;
  return new Date(ms).toISOString();
}

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

/** The incumbent `titles.trailer_key` precedence — first YouTube `Trailer`, else
 *  first YouTube anything. Reproduced exactly so persisting the full list can't
 *  quietly change which trailer the app already plays. */
export function pickTrailerKey(rows: TitleVideo[]): string | null {
  const youtube = rows.filter((r) => r.site === 'YouTube');
  return (youtube.find((r) => r.type === 'Trailer') ?? youtube[0])?.key ?? null;
}
