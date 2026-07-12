import { supabase } from '../supabase';

// Server-curated daily debate: the `daily_debate` table has a public-read row
// per date (today's pair + optional hook line, and — once the nightly
// `resolve_daily_debate()` cron has run — yesterday's frozen split + crowned
// top take). Writes go through the admin-gated `set_daily_debate` RPC (see
// the command-center picker), never a client insert/update.

export interface DailyDebate {
  heroAId: string;
  heroBId: string;
  hookText: string | null;
}

export interface YesterdayTopTake {
  body: string;
  displayName: string | null;
}

export interface YesterdayDebateResult {
  heroAId: string;
  heroBId: string;
  finalVotesA: number;
  finalVotesB: number;
  topTake: YesterdayTopTake | null;
}

interface DailyDebateRow {
  hero_a_id: string;
  hero_b_id: string;
  hook_text: string | null;
}

interface YesterdayRow {
  hero_a_id: string;
  hero_b_id: string;
  final_votes_a: number | null;
  final_votes_b: number | null;
  top_take_id: string | null;
}

/** UTC calendar date as YYYY-MM-DD. The nightly roll (`daily-debate-roll`)
 *  runs at 00:05 UTC and stamps `debate_date` from Postgres's `current_date`
 *  (UTC on Supabase), so anchoring the client to UTC keeps "today" in sync
 *  with the server's pick. */
export function todayIso(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function yesterdayIso(d = new Date()): string {
  const y = new Date(d);
  y.setUTCDate(y.getUTCDate() - 1);
  return todayIso(y);
}

export type SetDailyDebateResult = { ok: true } | { ok: false; error: string };

/** Command-center write: admin-gated `set_daily_debate` RPC (see
 *  supabase/migrations/20260712120000_matchup_takes_daily_debate.sql). Upserts
 *  the pair for `date`, clearing any prior resolution on that row. */
export async function setDailyDebate(
  date: string,
  heroAId: string,
  heroBId: string,
  hookText: string | null,
): Promise<SetDailyDebateResult> {
  const { error } = await supabase.rpc('set_daily_debate', {
    p_date: date,
    p_a: heroAId,
    p_b: heroBId,
    // The generated Args type doesn't reflect the RPC's `default null`
    // nullable param — the SQL function accepts (and needs to, to clear a
    // hook) a null hook text.
    p_hook: hookText as unknown as string,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** The curated pair for a given date, or null if no row exists yet (falls
 *  back to the client-seeded pick) or the read failed. */
export async function getDailyDebate(date: string): Promise<DailyDebate | null> {
  const { data, error } = await supabase
    .from('daily_debate')
    .select('hero_a_id, hero_b_id, hook_text')
    .eq('debate_date', date)
    .maybeSingle();
  if (error) {
    console.warn('[getDailyDebate] error:', error.message);
    return null;
  }
  if (!data) return null;
  const row = data as unknown as DailyDebateRow;
  return { heroAId: row.hero_a_id, heroBId: row.hero_b_id, hookText: row.hook_text };
}

/** Yesterday's frozen split + crowned top take, once `resolve_daily_debate()`
 *  has run. Null if there's no row for yesterday, or it hasn't resolved yet
 *  (final_votes still null — the nightly cron hasn't reached it). */
export async function getYesterdayResult(): Promise<YesterdayDebateResult | null> {
  const { data, error } = await supabase
    .from('daily_debate')
    .select('hero_a_id, hero_b_id, final_votes_a, final_votes_b, top_take_id')
    .eq('debate_date', yesterdayIso())
    .maybeSingle();
  if (error) {
    console.warn('[getYesterdayResult] error:', error.message);
    return null;
  }
  if (!data) return null;
  const row = data as unknown as YesterdayRow;
  if (row.final_votes_a === null || row.final_votes_b === null) return null;

  let topTake: YesterdayTopTake | null = null;
  if (row.top_take_id) {
    const { data: takeRow, error: takeError } = await supabase
      .from('matchup_takes')
      .select('body, user_id')
      .eq('id', row.top_take_id)
      .maybeSingle();
    if (takeError) {
      console.warn('[getYesterdayResult] take lookup error:', takeError.message);
    } else if (takeRow) {
      const t = takeRow as unknown as { body: string; user_id: string };
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('display_name')
        .eq('id', t.user_id)
        .maybeSingle();
      if (profileError) {
        console.warn('[getYesterdayResult] profile lookup error:', profileError.message);
      }
      const p = profile as unknown as { display_name: string | null } | null;
      topTake = { body: t.body, displayName: p?.display_name ?? null };
    }
  }

  return {
    heroAId: row.hero_a_id,
    heroBId: row.hero_b_id,
    finalVotesA: row.final_votes_a,
    finalVotesB: row.final_votes_b,
    topTake,
  };
}
