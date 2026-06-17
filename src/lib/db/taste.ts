import { supabase } from '../supabase';

// "Your Universe" — the signed-in user's taste profile, derived from their
// favourites (weighted 3x) + view history (1x) via the get_my_taste_profile RPC.
// Read-only; the RPC does the aggregation so the client just renders it.

export interface TasteFacet {
  name: string;
  weight: number;
}

export interface TasteTag {
  slug: string;
  label: string;
  weight: number;
}

export interface TasteProfile {
  /** Distinct heroes the profile is based on (favourited or viewed). */
  basedOn: number;
  publishers: TasteFacet[];
  franchises: TasteFacet[];
  tags: TasteTag[];
  alignment: { good: number; bad: number; neutral: number };
}

interface TasteJson {
  based_on?: number;
  publishers?: TasteFacet[];
  franchises?: TasteFacet[];
  tags?: TasteTag[];
  alignment?: { good?: number; bad?: number; neutral?: number };
}

export async function getTasteProfile(): Promise<TasteProfile | null> {
  const { data, error } = await supabase.rpc('get_my_taste_profile');
  if (error) {
    console.warn('[getTasteProfile] error:', error.message);
    return null;
  }
  const d = (data ?? {}) as TasteJson;
  return {
    basedOn: d.based_on ?? 0,
    publishers: d.publishers ?? [],
    franchises: d.franchises ?? [],
    tags: d.tags ?? [],
    alignment: {
      good: d.alignment?.good ?? 0,
      bad: d.alignment?.bad ?? 0,
      neutral: d.alignment?.neutral ?? 0,
    },
  };
}

/** The user's dominant alignment as a display label, or null if they have none. */
export function dominantAlignment(t: TasteProfile): string | null {
  const { good, bad, neutral } = t.alignment;
  const max = Math.max(good, bad, neutral);
  if (max <= 0) return null;
  if (good === max) return 'Heroes';
  if (bad === max) return 'Villains';
  return 'Anti-Heroes';
}

/** Tidy a raw publisher string for display ("DC Comics" → "DC"). */
export function shortPublisher(name: string): string {
  return name.replace(/\s+comics$/i, '').trim();
}
