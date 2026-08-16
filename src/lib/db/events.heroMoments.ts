// src/lib/db/events.heroMoments.ts
// The weeks a character was being read about, from the other direction.
//
// The events system pointed one way for its whole existence: an edition lists
// its characters, and nothing pointed back. So the most expensive data in the
// app — a decade of per-article Wikipedia readership, swept one hero at a time —
// was visible only on the archive, which is the surface with the least traffic
// in the product.
//
// Reversed, it is a good line on the app's most-visited page, and it is sourced,
// dated and linkable: "read 12x more than usual during D23 2026".
import { supabase } from '../supabase';

export interface HeroEventMoment {
  slug: string;
  editionSlug: string;
  /** The event's name, not the edition's — "New York Comic Con". */
  headline: string;
  accent: string | null;
  liveFrom: string | null;
  liveTo: string | null;
  venueCity: string | null;
  /** Multiple of this character's own ordinary week. */
  spike: number | null;
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

/** Raw jsonb → the shape the view consumes. Exported for tests. */
export function mapHeroEventMoments(raw: unknown): HeroEventMoment[] {
  if (!Array.isArray(raw)) return [];
  return (
    (raw as Record<string, unknown>[])
      .map((m) => ({
        slug: String(m.slug ?? ''),
        editionSlug: String(m.edition_slug ?? ''),
        headline: String(m.headline ?? ''),
        accent: typeof m.accent === 'string' && m.accent ? m.accent : null,
        liveFrom: typeof m.live_from === 'string' ? m.live_from : null,
        liveTo: typeof m.live_to === 'string' ? m.live_to : null,
        venueCity: typeof m.venue_city === 'string' && m.venue_city ? m.venue_city : null,
        spike: num(m.spike),
      }))
      // An entry with no route is not a link, and this section is entirely a set
      // of links.
      .filter((m) => m.slug && m.editionSlug && m.headline)
  );
}

export async function getHeroEventMoments(heroId: string, limit = 6): Promise<HeroEventMoment[]> {
  const { data, error } = await supabase.rpc('get_hero_event_moments', {
    p_hero_id: heroId,
    p_limit: limit,
  });
  // Soft-fails to an empty section rather than throwing: this is one block on a
  // large page, and an RPC that does not exist yet (or a hero nobody swept) must
  // not take the character page down with it.
  if (error) return [];
  return mapHeroEventMoments(data);
}
