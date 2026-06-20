// Server side of the daily game's stats: record an anonymous per-day result and
// read back the global guess distribution (for the "you beat X%" percentile).
import { supabase } from '../supabase';
import type { DailyDistribution } from '../game/stats';

export async function recordDailyResult(
  date: string,
  won: boolean,
  guesses: number,
): Promise<void> {
  await supabase.rpc('record_daily_result', { p_date: date, p_won: won, p_guesses: guesses });
}

export async function getDailyDistribution(date: string): Promise<DailyDistribution | null> {
  const { data, error } = await supabase.rpc('get_daily_distribution', { p_date: date });
  if (error || !data) return null;
  return data as unknown as DailyDistribution;
}
