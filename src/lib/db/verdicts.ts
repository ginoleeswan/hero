import { supabase } from '../supabase';

/** Always store/look up with the lexicographically smaller ID first so A vs B
 *  and B vs A share a single row. Verdict text references hero names, not
 *  "side A/B", so it reads correctly regardless of which way round you loaded. */
function normalizeKey(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a];
}

export async function getCachedVerdict(heroAId: string, heroBId: string): Promise<string | null> {
  const [a, b] = normalizeKey(heroAId, heroBId);
  const { data } = await supabase
    .from('verdicts')
    .select('verdict')
    .eq('hero_a_id', a)
    .eq('hero_b_id', b)
    .maybeSingle();
  return data?.verdict ?? null;
}

// Writes happen server-side: the generate-verdict edge function persists the
// cache with the service_role key. The verdicts table is read-only to clients.
