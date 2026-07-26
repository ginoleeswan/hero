// src/lib/db/houses.ts
// The houses table, for search and for the index.
//
// Eight rows today, so everything here could be a constant — but houses are
// data, not a registry like PUBLISHER_BRANDS, and the moment a second franchise
// gets trees this stops being small. Queried, cached, and ranked client-side.
import { supabase } from '../supabase';

export interface HouseSearchResult {
  slug: string;
  name: string;
  universe: string;
  seat: string | null;
  words: string | null;
  sigil_tint: string | null;
  memberCount: number;
  /** Exact hit on the name or the bare surname — can drive the top-result row. */
  exact: boolean;
}

const HOUSE_COLS = 'slug, name, universe, seat, words, sigil_tint, house_members(count)';

interface HouseRow {
  slug: string;
  name: string;
  universe: string;
  seat: string | null;
  words: string | null;
  sigil_tint: string | null;
  house_members: { count: number }[] | null;
}

const norm = (s: string) => s.toLowerCase().replace(/[\s\-_.]/g, '');

/**
 * "House Targaryen" → ["housetargaryen", "targaryen"].
 *
 * People type the surname, not the full style — "targaryen", "stark". Matching
 * only the stored name would make the most obvious query miss.
 */
function keysFor(name: string): string[] {
  const full = norm(name);
  const bare = norm(name.replace(/^\s*(house|clan|family)\s+/i, ''));
  return bare && bare !== full ? [full, bare] : [full];
}

function shape(row: HouseRow, exact: boolean): HouseSearchResult {
  return {
    slug: row.slug,
    name: row.name,
    universe: row.universe,
    seat: row.seat,
    words: row.words,
    sigil_tint: row.sigil_tint,
    memberCount: row.house_members?.[0]?.count ?? 0,
    exact,
  };
}

/** Every house, biggest first — the index page and the universe-page row. */
export async function listHouses(): Promise<HouseSearchResult[]> {
  const { data, error } = await supabase.from('houses').select(HOUSE_COLS).order('name');
  if (error) {
    console.warn('[listHouses] error:', error.message);
    return [];
  }
  return ((data ?? []) as unknown as HouseRow[])
    .map((r) => shape(r, false))
    .sort((a, b) => b.memberCount - a.memberCount || a.name.localeCompare(b.name));
}

/** The houses belonging to one universe. Empty for the ~200 that have none. */
export async function listHousesForUniverse(universe: string): Promise<HouseSearchResult[]> {
  const u = universe.trim();
  if (!u) return [];
  const { data, error } = await supabase.from('houses').select(HOUSE_COLS).eq('universe', u);
  if (error) {
    console.warn('[listHousesForUniverse] error:', error.message);
    return [];
  }
  return ((data ?? []) as unknown as HouseRow[])
    .map((r) => shape(r, false))
    .sort((a, b) => b.memberCount - a.memberCount || a.name.localeCompare(b.name));
}

/**
 * Fuzzy-search houses. Ranking mirrors the universe search: exact (0) before
 * prefix (1) before contains (2), then by size — a query matching two houses
 * should lead with the one that has a tree worth looking at.
 */
export async function searchHouses(query: string, limit = 4): Promise<HouseSearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  // The stored name carries the "House " prefix, so a surname query has to be
  // matched against both forms — do the wide fetch, rank in memory. Eight rows.
  const { data, error } = await supabase.from('houses').select(HOUSE_COLS);
  if (error) {
    console.warn('[searchHouses] error:', error.message);
    return [];
  }
  const qn = norm(q);
  const scored: { row: HouseRow; rank: number }[] = [];
  for (const row of (data ?? []) as unknown as HouseRow[]) {
    let rank = Infinity;
    for (const key of keysFor(row.name)) {
      if (key === qn) rank = Math.min(rank, 0);
      else if (key.startsWith(qn)) rank = Math.min(rank, 1);
      else if (key.includes(qn)) rank = Math.min(rank, 2);
    }
    if (rank !== Infinity) scored.push({ row, rank });
  }
  return scored
    .map(({ row, rank }) => ({ result: shape(row, rank === 0), rank }))
    .sort((a, b) => a.rank - b.rank || b.result.memberCount - a.result.memberCount)
    .slice(0, limit)
    .map(({ result }) => result);
}
