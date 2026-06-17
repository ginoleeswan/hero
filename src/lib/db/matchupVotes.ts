import { supabase } from '../supabase';

// Community "Who would win?" votes for a matchup pair. The aggregate tally is
// read/written through SECURITY DEFINER RPCs (get_matchup_tally / cast_matchup_vote)
// so the matchup_votes table itself stays locked to each user's own row. Pair
// order is normalized server-side, so callers pass heroes in display order and
// the tally comes back relative to that order.

export interface MatchupTally {
  /** Votes for the hero passed as `a`. */
  votesA: number;
  /** Votes for the hero passed as `b`. */
  votesB: number;
  total: number;
  /** The caller's own pick (a hero id), or null if they haven't voted. */
  myPick: string | null;
}

// The RPCs return a json object; PostgREST hands it back loosely typed.
interface TallyJson {
  votes_a?: number;
  votes_b?: number;
  total?: number;
  my_pick?: string | null;
}

function toTally(data: unknown): MatchupTally {
  const d = (data ?? {}) as TallyJson;
  return {
    votesA: d.votes_a ?? 0,
    votesB: d.votes_b ?? 0,
    total: d.total ?? 0,
    myPick: d.my_pick ?? null,
  };
}

/** Read the crowd tally for a pair plus the caller's own pick. Null on error. */
export async function getMatchupTally(a: string, b: string): Promise<MatchupTally | null> {
  const { data, error } = await supabase.rpc('get_matchup_tally', { p_a: a, p_b: b });
  if (error) {
    console.warn('[getMatchupTally] error:', error.message);
    return null;
  }
  return toTally(data);
}

export interface BattleRecord {
  /** Total matchups the user has voted on. */
  total: number;
  /** How many of those votes sided with the crowd majority. */
  agree: number;
  /** agree / total as a whole percentage (0 when no votes). */
  agreePct: number;
  /** Consecutive days with a vote, ending today or yesterday (0 if broken). */
  streak: number;
}

/** The signed-in user's matchup voting record, for the profile. Null on error. */
export async function getBattleRecord(): Promise<BattleRecord | null> {
  const { data, error } = await supabase.rpc('get_my_battle_record');
  if (error) {
    console.warn('[getBattleRecord] error:', error.message);
    return null;
  }
  const d = (data ?? {}) as { total?: number; agree?: number; streak?: number };
  const total = d.total ?? 0;
  const agree = d.agree ?? 0;
  return {
    total,
    agree,
    agreePct: total > 0 ? Math.round((agree / total) * 100) : 0,
    streak: d.streak ?? 0,
  };
}

/** Cast (or change) the caller's pick; returns the fresh tally. Null on error. */
export async function castMatchupVote(
  a: string,
  b: string,
  pickedId: string,
): Promise<MatchupTally | null> {
  const { data, error } = await supabase.rpc('cast_matchup_vote', {
    p_a: a,
    p_b: b,
    p_picked: pickedId,
  });
  if (error) {
    console.warn('[castMatchupVote] error:', error.message);
    return null;
  }
  return toTally(data);
}
