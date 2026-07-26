import { supabase } from '../supabase';

// Trailer-drop events — "a trailer landed 3h ago", the freshest signal the
// catalogue can produce. Backed by title_videos, populated from the TMDB video
// lists the enrichment pipeline was already fetching and discarding (see
// docs/superpowers/specs/2026-07-26-live-events-and-pulse-design.md §3.1).

export interface TrailerEvent {
  titleId: string;
  title: string;
  mediaType: string | null;
  releaseDate: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  /** YouTube id — what a play affordance needs. */
  videoKey: string;
  /** 'Trailer' or 'Teaser'. */
  videoType: string | null;
  videoName: string | null;
  /** ISO-8601. Never null here: the RPC only returns dated videos. */
  publishedAt: string;
  /** Catalogue characters with art attached to this title. */
  characterCount: number;
  maxFame: number | null;
}

interface TrailerEventRow {
  title_id: string;
  title: string;
  media_type: string | null;
  release_date: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  video_key: string;
  video_type: string | null;
  video_name: string | null;
  published_at: string;
  character_count: number | null;
  max_fame: number | null;
}

/** Flat RPC rows → TrailerEvent. Exported so the explore-bundle path can share it
 *  when this folds into get_explore_bundle. */
export function mapTrailerRows(rows: TrailerEventRow[]): TrailerEvent[] {
  return rows.map((r) => ({
    titleId: r.title_id,
    title: r.title,
    mediaType: r.media_type,
    releaseDate: r.release_date,
    posterUrl: r.poster_url,
    backdropUrl: r.backdrop_url,
    videoKey: r.video_key,
    videoType: r.video_type,
    videoName: r.video_name,
    publishedAt: r.published_at,
    characterCount: r.character_count ?? 0,
    maxFame: r.max_fame,
  }));
}

/** Trailers and teasers published inside the window, newest first. Degrades to []
 *  so a DB hiccup never errors the Explore band. */
export async function getRecentTrailers(hours = 72, limit = 12): Promise<TrailerEvent[]> {
  const { data, error } = await supabase.rpc('get_recent_trailers', {
    p_hours: hours,
    p_limit: limit,
  });
  if (error) {
    console.warn('[getRecentTrailers] error:', error.message);
    return [];
  }
  // The generated Returns marks every column non-null — a RETURNS TABLE signature
  // carries no nullability — so widen to the row shape this actually guards for.
  return mapTrailerRows((data ?? []) as TrailerEventRow[]);
}
