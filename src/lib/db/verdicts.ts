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

export async function saveVerdict(
  heroAId: string,
  heroBId: string,
  verdict: string,
): Promise<void> {
  const [a, b] = normalizeKey(heroAId, heroBId);
  await supabase
    .from('verdicts')
    .upsert({ hero_a_id: a, hero_b_id: b, verdict }, { onConflict: 'hero_a_id,hero_b_id' });
}
