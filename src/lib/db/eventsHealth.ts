// src/lib/db/eventsHealth.ts
// One read for the whole events pipeline — detector state, channel feeds, and
// what has actually been archived.
//
// This exists because inverting the approval gate inverted the failure mode.
// While publishing needed a human, the failure was "nothing ever publishes":
// silent, and safe. Now it is "something wrong publishes and nobody notices":
// silent, and not. A veto is only a control if someone can see what it would be
// vetoing, and there was no admin surface for watched_events or media_channels
// at all — the approval RPCs existed and nothing called them.
import { supabase } from '../supabase';

export interface WatchedEventHealth {
  slug: string;
  headline: string;
  verdict: 'idle' | 'watch' | 'live' | string;
  approval: 'pending' | 'approved' | 'rejected' | string;
  enabled: boolean;
  spikeRatio: number | null;
  peak: number | null;
  editsRecent: number | null;
  shape: string | null;
  liveFrom: string | null;
  liveTo: string | null;
  ongoing: boolean;
  /** When the detector last looked. The honest freshness signal — a verdict
   *  cannot tell you the sync died three hours ago. */
  checkedAt: string | null;
  firstDetectedAt: string | null;
  /** On the rail RIGHT NOW. Not derivable from verdict: the grace window and the
   *  rejection flag both apply. */
  isLive: boolean;
  editions: number;
}

export interface ChannelHealth {
  id: string;
  name: string;
  slug: string;
  official: boolean;
  enabled: boolean;
  checkedAt: string | null;
  /** Newest upload seen. Stale means dormant OR silently broken, and the only
   *  way to tell them apart is to look. */
  lastVideoAt: string | null;
  videos: number;
  matched: number;
}

export interface EditionHealth {
  slug: string;
  editionSlug: string;
  headline: string;
  liveFrom: string | null;
  liveTo: string | null;
  spikeRatio: number | null;
  movers: number;
  frozenAt: string | null;
}

export interface EventsHealth {
  events: WatchedEventHealth[];
  channels: ChannelHealth[];
  editions: EditionHealth[];
  generatedAt: string | null;
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
};
const arr = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? (v as Record<string, unknown>[]) : [];

/** Raw jsonb → the shape the panel consumes. Exported for tests. */
export function mapEventsHealth(raw: unknown): EventsHealth {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    events: arr(r.events).map((e) => ({
      slug: String(e.slug ?? ''),
      headline: String(e.headline ?? ''),
      verdict: String(e.verdict ?? 'idle'),
      approval: String(e.approval ?? 'pending'),
      enabled: e.enabled !== false,
      spikeRatio: num(e.spike_ratio),
      peak: num(e.peak),
      editsRecent: num(e.edits_recent),
      shape: (e.shape as string) ?? null,
      liveFrom: (e.live_from as string) ?? null,
      liveTo: (e.live_to as string) ?? null,
      ongoing: e.ongoing === true,
      checkedAt: (e.checked_at as string) ?? null,
      firstDetectedAt: (e.first_detected_at as string) ?? null,
      isLive: e.is_live === true,
      editions: num(e.editions) ?? 0,
    })),
    channels: arr(r.channels).map((c) => ({
      id: String(c.id ?? ''),
      name: String(c.name ?? ''),
      slug: String(c.slug ?? ''),
      official: c.official !== false,
      enabled: c.enabled !== false,
      checkedAt: (c.checked_at as string) ?? null,
      lastVideoAt: (c.last_video_at as string) ?? null,
      videos: num(c.videos) ?? 0,
      matched: num(c.matched) ?? 0,
    })),
    editions: arr(r.editions).map((e) => ({
      slug: String(e.slug ?? ''),
      editionSlug: String(e.edition_slug ?? ''),
      headline: String(e.headline ?? ''),
      liveFrom: (e.live_from as string) ?? null,
      liveTo: (e.live_to as string) ?? null,
      spikeRatio: num(e.spike_ratio),
      movers: num(e.movers) ?? 0,
      frozenAt: (e.frozen_at as string) ?? null,
    })),
    generatedAt: (r.generated_at as string) ?? null,
  };
}

export async function getEventsHealth(): Promise<EventsHealth> {
  const { data, error } = await supabase.rpc('admin_events_health');
  if (error) throw new Error(error.message);
  return mapEventsHealth(data);
}

/** Set the veto. `rejected` is the kill switch; `approved` clears it. */
export async function setEventApproval(slug: string, approval: string): Promise<void> {
  const { error } = await supabase.rpc('admin_set_watched_event_approval', {
    p_slug: slug,
    p_approval: approval,
  });
  if (error) throw new Error(error.message);
}
