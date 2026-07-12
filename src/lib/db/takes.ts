import { supabase } from '../supabase';
import { getHeroesByIds } from './heroes';

// Structured matchup takes: pick-a-side one-liners. Reads are plain selects
// (public RLS on visible rows); writes go through SECURITY DEFINER RPCs.
//
// matchup_takes.user_id references auth.users (not user_profiles), so
// PostgREST can't embed the display name via a `profiles(display_name)`
// select — there's no FK for it to walk. getTakes fetches display names with
// a second `in()` query against user_profiles instead.

export interface Take {
  id: string;
  heroAId: string;
  heroBId: string;
  userId: string;
  pickedId: string;
  body: string;
  agreeCount: number;
  createdAt: string;
  displayName: string | null;
}

interface TakeRow {
  id: string;
  hero_a_id: string;
  hero_b_id: string;
  user_id: string;
  picked_id: string;
  body: string;
  agree_count: number;
  created_at: string;
}

function toTake(r: TakeRow, displayName: string | null): Take {
  return {
    id: r.id,
    heroAId: r.hero_a_id,
    heroBId: r.hero_b_id,
    userId: r.user_id,
    pickedId: r.picked_id,
    body: r.body,
    agreeCount: r.agree_count,
    createdAt: r.created_at,
    displayName,
  };
}

function normalizeKey(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a];
}

/** Visible takes for a pair, best-agreed first. Empty array on error. */
export async function getTakes(a: string, b: string): Promise<Take[]> {
  const [lo, hi] = normalizeKey(a, b);
  const { data, error } = await supabase
    .from('matchup_takes')
    .select('*')
    .eq('hero_a_id', lo)
    .eq('hero_b_id', hi)
    .order('agree_count', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) {
    console.warn('[getTakes] error:', error.message);
    return [];
  }
  const rows = (data ?? []) as unknown as TakeRow[];
  if (rows.length === 0) return [];

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: profiles, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, display_name')
    .in('id', userIds);
  if (profileError) {
    console.warn('[getTakes] profile lookup error:', profileError.message);
  }
  const nameById = new Map<string, string | null>(
    ((profiles ?? []) as unknown as { id: string; display_name: string | null }[]).map((p) => [
      p.id,
      p.display_name,
    ]),
  );

  return rows.map((r) => toTake(r, nameById.get(r.user_id) ?? null));
}

export interface MyTake extends Take {
  heroAName: string;
  heroBName: string;
}

/**
 * The caller's own takes across every pair, newest first, for the profile
 * screen. Hero names for the pair label come from a second heroes-by-ids
 * fetch — matchup_takes only stores ids. Empty array on error or no rows.
 */
export async function getMyTakes(userId: string): Promise<MyTake[]> {
  const { data, error } = await supabase
    .from('matchup_takes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[getMyTakes] error:', error.message);
    return [];
  }
  const rows = (data ?? []) as unknown as TakeRow[];
  if (rows.length === 0) return [];

  const heroIds = [...new Set(rows.flatMap((r) => [r.hero_a_id, r.hero_b_id]))];
  const heroes = await getHeroesByIds(heroIds);
  const nameById = new Map(heroes.map((h) => [h.id, h.name]));

  return rows.map((r) => ({
    ...toTake(r, null),
    heroAName: nameById.get(r.hero_a_id) ?? 'Unknown',
    heroBName: nameById.get(r.hero_b_id) ?? 'Unknown',
  }));
}

/** Post (or replace) the caller's take. Auth required; null on error. */
export async function postTake(
  a: string,
  b: string,
  pickedId: string,
  body: string,
): Promise<Take | null> {
  const { data, error } = await supabase.rpc('post_take', {
    p_a: a,
    p_b: b,
    p_picked: pickedId,
    p_body: body,
  });
  if (error) {
    console.warn('[postTake] error:', error.message);
    return null;
  }
  // The caller already knows their own display name if they need it; avoid a
  // redundant profile lookup here.
  return toTake(data as unknown as TakeRow, null);
}

/** Delete the caller's own take (RLS-enforced). */
export async function deleteTake(id: string): Promise<boolean> {
  const { error } = await supabase.from('matchup_takes').delete().eq('id', id);
  if (error) {
    console.warn('[deleteTake] error:', error.message);
    return false;
  }
  return true;
}

/** Toggle agreement on a take. Works anon (voter key) and signed-in. */
export async function toggleAgree(
  takeId: string,
  voterKey: string,
): Promise<{ agreed: boolean; agreeCount: number } | null> {
  const { data, error } = await supabase.rpc('toggle_take_agreement', {
    p_take_id: takeId,
    p_voter_key: voterKey,
  });
  if (error) {
    console.warn('[toggleAgree] error:', error.message);
    return null;
  }
  const d = (data ?? {}) as { agreed?: boolean; agree_count?: number };
  return { agreed: d.agreed ?? false, agreeCount: d.agree_count ?? 0 };
}
