// src/lib/db/events.dossier.ts
// The permanent page for a watched event — one round trip, same jsonb shape as
// get_house and get_explore_bundle.
//
// Why a page and not just the rail: the rail is empty by Monday, this is the
// same week's facts still worth reading a year later. See
// docs/superpowers/specs/2026-07-27-pulse-reach-design.md §3.
import { supabase } from '../supabase';

export interface EventDossierEvent {
  slug: string;
  headline: string;
  blurb: string | null;
  accent: string | null;
  liveFrom: string | null;
  liveTo: string | null;
  ongoing: boolean;
  shape: string | null;
  /** The detection evidence. Publishing it is deliberate — nobody else shows how
   *  they know a convention is on. */
  spikeRatio: number | null;
  baseline: number | null;
  peak: number | null;
  editsRecent: number | null;
  viewsDaily: { date: string; views: number }[];
  firstDetectedAt: string | null;
}

export interface EventTrailer {
  titleId: string;
  title: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  releaseDate: string | null;
  videoKey: string | null;
  videoType: string | null;
  publishedAt: string | null;
  castCount: number;
}

export interface EventSurge {
  heroId: string;
  name: string;
  publisher: string | null;
  portraitUrl: string | null;
  spike: number | null;
  pageviewsWeek: number | null;
  started: string | null;
  causeKind: string | null;
  causeLabel: string | null;
}

export interface EventIssue {
  id: string;
  volumeName: string | null;
  issueNumber: string | null;
  coverUrl: string | null;
  publisher: string | null;
  storeDate: string | null;
}

export interface EventDossier {
  event: EventDossierEvent;
  trailers: EventTrailer[];
  surges: EventSurge[];
  issues: EventIssue[];
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

/** Raw jsonb → the shape the views consume. Exported for tests; the RPC returns
 *  snake_case straight from Postgres, and nothing else in the app should have to
 *  know that. */
export function mapEventDossier(raw: unknown): EventDossier | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const e = r.event as Record<string, unknown> | undefined;
  if (!e || typeof e.slug !== 'string' || typeof e.headline !== 'string') return null;

  const arr = (v: unknown): Record<string, unknown>[] =>
    Array.isArray(v) ? (v as Record<string, unknown>[]) : [];

  return {
    event: {
      slug: e.slug,
      headline: e.headline,
      blurb: (e.blurb as string) ?? null,
      accent: (e.accent as string) ?? null,
      liveFrom: (e.live_from as string) ?? null,
      liveTo: (e.live_to as string) ?? null,
      ongoing: e.ongoing === true,
      shape: (e.shape as string) ?? null,
      spikeRatio: num(e.spike_ratio),
      baseline: num(e.baseline),
      peak: num(e.peak),
      editsRecent: num(e.edits_recent),
      viewsDaily: arr(e.views_daily)
        .map((d) => ({ date: String(d.date ?? ''), views: num(d.views) ?? 0 }))
        .filter((d) => d.date),
      firstDetectedAt: (e.first_detected_at as string) ?? null,
    },
    trailers: arr(r.trailers).map((t) => ({
      titleId: String(t.title_id ?? ''),
      title: String(t.title ?? ''),
      posterUrl: (t.poster_url as string) ?? null,
      backdropUrl: (t.backdrop_url as string) ?? null,
      releaseDate: (t.release_date as string) ?? null,
      videoKey: (t.video_key as string) ?? null,
      videoType: (t.video_type as string) ?? null,
      publishedAt: (t.published_at as string) ?? null,
      castCount: num(t.cast_count) ?? 0,
    })),
    surges: arr(r.surges).map((s) => ({
      heroId: String(s.hero_id ?? ''),
      name: String(s.name ?? ''),
      publisher: (s.publisher as string) ?? null,
      portraitUrl: (s.portrait_url as string) ?? null,
      spike: num(s.spike),
      pageviewsWeek: num(s.pageviews_week),
      started: (s.started as string) ?? null,
      causeKind: (s.cause_kind as string) ?? null,
      causeLabel: (s.cause_label as string) ?? null,
    })),
    issues: arr(r.issues).map((i) => ({
      id: String(i.id ?? ''),
      volumeName: (i.volume_name as string) ?? null,
      issueNumber: (i.issue_number as string) ?? null,
      coverUrl: (i.cover_url as string) ?? null,
      publisher: (i.publisher as string) ?? null,
      storeDate: (i.store_date as string) ?? null,
    })),
  };
}

/** Null for an unknown, disabled or unapproved event — the caller renders a
 *  not-found rather than an empty shell. */
export async function getEventDossier(slug: string): Promise<EventDossier | null> {
  const { data, error } = await supabase.rpc('get_event_dossier', { p_slug: slug });
  // Throw rather than returning null: a null here means "no event with that
  // slug", and a failed RPC is a different thing the screen must be able to
  // retry. Returning null for both made every outage look like a dead link.
  if (error) throw new Error(`[getEventDossier] ${error.message}`);
  return mapEventDossier(data);
}

// ── index ────────────────────────────────────────────────────────────────────

export interface EventIndexEntry {
  slug: string;
  headline: string;
  accent: string | null;
  liveFrom: string | null;
  liveTo: string | null;
  ongoing: boolean;
  spikeRatio: number | null;
  peak: number | null;
  /** Still inside the detection window — the rail is showing it right now. */
  isLive: boolean;
  viewsDaily: { date: string; views: number }[];
}

export interface EventIndex {
  events: EventIndexEntry[];
  /** Polled but not yet confirmed. Shown so the page is a complete idea rather
   *  than one row in a void. */
  watching: { slug: string; headline: string }[];
  /** How many events are polled at all. Most have never fired, and the page says
   *  so — one row without that context reads like a broken feature. */
  watched: number;
}

export function mapEventIndex(raw: unknown): EventIndex {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const list = Array.isArray(r.events) ? (r.events as Record<string, unknown>[]) : [];
  const watchList = Array.isArray(r.watching) ? (r.watching as Record<string, unknown>[]) : [];
  return {
    watched: num(r.watched) ?? 0,
    watching: watchList
      .filter((w) => typeof w.slug === 'string' && typeof w.headline === 'string')
      .map((w) => ({ slug: w.slug as string, headline: w.headline as string })),
    events: list
      .filter((e) => typeof e.slug === 'string' && typeof e.headline === 'string')
      .map((e) => ({
        slug: e.slug as string,
        headline: e.headline as string,
        accent: (e.accent as string) ?? null,
        liveFrom: (e.live_from as string) ?? null,
        liveTo: (e.live_to as string) ?? null,
        ongoing: e.ongoing === true,
        spikeRatio: num(e.spike_ratio),
        peak: num(e.peak),
        isLive: e.is_live === true,
        viewsDaily: (Array.isArray(e.views_daily)
          ? (e.views_daily as Record<string, unknown>[])
          : []
        )
          .map((d) => ({ date: String(d.date ?? ''), views: num(d.views) ?? 0 }))
          .filter((d) => d.date),
      })),
  };
}

/** Degrades to an empty index so the page renders its own empty state rather
 *  than erroring. */
export async function getEventIndex(): Promise<EventIndex> {
  const { data, error } = await supabase.rpc('get_event_index');
  if (error) {
    console.warn('[getEventIndex] error:', error.message);
    return { events: [], watching: [], watched: 0 };
  }
  return mapEventIndex(data);
}
