import { supabase } from '../supabase';

function normalizeKey(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a];
}

/** Read the cached AI verdict for a team pair. Null on miss/error. */
export async function getCachedTeamVerdict(teamAId: string, teamBId: string): Promise<string | null> {
  const [a, b] = normalizeKey(teamAId, teamBId);
  const { data } = await supabase
    .from('team_verdicts')
    .select('verdict')
    .eq('team_a_id', a)
    .eq('team_b_id', b)
    .maybeSingle();
  return data?.verdict ?? null;
}
