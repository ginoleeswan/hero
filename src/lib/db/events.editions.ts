// src/lib/db/events.editions.ts
// The durable half of an event: the series hub, and one frozen edition of it.
//
// events.dossier.ts reads the LIVE watched_events row, which sync-watched-events
// overwrites every 30 minutes. That is the right source for "what is happening at
// D23 right now" and structurally cannot answer "what happened at D23 in 2026" —
// the question with an audience, because it is the one people type in October.
//
// So this module reads event_editions instead. Two shapes:
//
//   getEventHub(slug)               the series. Permanent, lists its editions,
//                                   says whether it is live right now.
//   getEventEdition(slug, edition)  one year of it, mapped into the SAME
//                                   EventDossier shape the live page uses.
//
// That last decision is deliberate: an edition page and a live page are the same
// page with different tenses, so they share EventDossier rather than growing a
// near-identical twin that drifts. `movers` becomes `surges`, `ongoing` is false
// because a frozen edition is by definition not running, and everything else
// lines up field for field.
import { supabase } from '../supabase';
import { mapEventDossier, type EventDossier } from './events.dossier';

/** One edition, as listed on the hub. Enough to choose a year, no more. */
export interface EventEditionSummary {
  /** URL segment: '2026', or '2026-08' when a year holds two (Comiket). */
  editionSlug: string;
  headline: string;
  liveFrom: string | null;
  liveTo: string | null;
  spikeRatio: number | null;
  peak: number | null;
  /** One sentence on what actually happened, where it can be stated plainly.
   *  Editorial, and the only field here that is not a measurement — 129 of the
   *  142 editions predate the announcement feed and can never get one, so this
   *  is the only thing that can answer "what happened at D23 2019". Null on any
   *  edition where the answer would be a guess, and null renders as nothing. */
  recap: string | null;
  /** Characters whose readership broke out — frozen at the time. */
  movers: number;
  /** Studio uploads inside the window. The "what was announced" count. */
  announcements: number;
  /** Up to three movers with portraits, in the archive's own ranking. A row of
   *  faces is what tells a reader what a year was ABOUT — eight lines of
   *  multiples do not. */
  faces: { heroId: string; name: string; portraitUrl: string }[];
}

export interface EventHub {
  slug: string;
  headline: string;
  accent: string | null;
  blurb: string | null;
  enwikiTitle: string | null;
  /** True only while the detector currently calls it live. */
  isLive: boolean;
  /** The CURRENT window — meaningful only while live; editions carry their own. */
  liveFrom: string | null;
  liveTo: string | null;
  shape: string | null;
  spikeRatio: number | null;
  /** The loudest edition on record, so a row can be drawn in proportion. */
  bestSpike: number | null;
  editions: EventEditionSummary[];
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

const arr = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? (v as Record<string, unknown>[]) : [];

/** Raw jsonb → EventHub. Exported for tests. */
export function mapEventHub(raw: unknown): EventHub | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.slug !== 'string' || typeof r.headline !== 'string') return null;
  return {
    slug: r.slug,
    headline: r.headline,
    accent: (r.accent as string) ?? null,
    blurb: (r.blurb as string) ?? null,
    enwikiTitle: (r.enwiki_title as string) ?? null,
    isLive: r.is_live === true,
    liveFrom: (r.live_from as string) ?? null,
    liveTo: (r.live_to as string) ?? null,
    shape: (r.shape as string) ?? null,
    spikeRatio: num(r.spike_ratio),
    bestSpike: num(r.best_spike),
    editions: arr(r.editions)
      .map((e) => ({
        editionSlug: String(e.edition_slug ?? ''),
        headline: String(e.headline ?? r.headline),
        liveFrom: (e.live_from as string) ?? null,
        liveTo: (e.live_to as string) ?? null,
        spikeRatio: num(e.spike_ratio),
        peak: num(e.peak),
        recap: typeof e.recap === 'string' && e.recap ? e.recap : null,
        movers: num(e.movers) ?? 0,
        announcements: num(e.announcements) ?? 0,
        faces: (Array.isArray(e.faces) ? (e.faces as Record<string, unknown>[]) : [])
          .map((f) => ({
            heroId: String(f.hero_id ?? ''),
            name: String(f.name ?? ''),
            portraitUrl: String(f.portrait_url ?? ''),
          }))
          .filter((f) => f.heroId && f.portraitUrl),
      }))
      // An edition with no slug cannot be routed to, so it is not a row.
      .filter((e) => e.editionSlug),
  };
}

/**
 * Raw jsonb → EventDossier, so the edition page reuses the live page's body.
 *
 * The RPC calls the frozen surge list `movers`, because on an archived page it is
 * a noun rather than a live signal. The component knows it as `surges`.
 */
export function mapEventEdition(raw: unknown): EventDossier | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  return mapEventDossier({
    ...r,
    // Frozen by definition: nothing archived is still running, and `ongoing`
    // drives the "Happening now" eyebrow.
    event: { ...(r.event as Record<string, unknown>), ongoing: false },
    surges: r.movers,
  });
}

export async function getEventHub(slug: string): Promise<EventHub | null> {
  const { data, error } = await supabase.rpc('get_event_hub', { p_slug: slug });
  // Throw rather than return null: the caller distinguishes "no such event" from
  // "the fetch failed", and collapsing them makes every outage look like a dead
  // link — the exact bug events.dossier.ts already had and fixed.
  if (error) throw new Error(error.message);
  return mapEventHub(data);
}

export async function getEventEdition(slug: string, edition: string): Promise<EventDossier | null> {
  const { data, error } = await supabase.rpc('get_event_edition', {
    p_slug: slug,
    p_edition: edition,
  });
  if (error) throw new Error(error.message);
  return mapEventEdition(data);
}
