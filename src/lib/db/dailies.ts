import { supabase } from '../supabase';
import { getDailyDebate, todayIso } from './dailyDebate';
import { getTodaysTeamBattle } from './teams';

// Daily-streak plumbing (signed-in only). Completing ANY daily surface counts
// the day; the server keeps the calendar (user_daily_completions) and computes
// the streak (get_my_daily_streak). Logged-out users keep the local puzzle
// streak — there is no cross-surface anon identity.

export type DailySurface = 'puzzle' | 'debate' | 'team_battle';

export interface DailyStreak {
  current: number;
  longest: number;
  today: Record<DailySurface, boolean>;
}

const EMPTY: DailyStreak = {
  current: 0,
  longest: 0,
  today: { puzzle: false, debate: false, team_battle: false },
};

/**
 * Record a completion for TODAY (UTC — the server stamps current_date itself).
 * Fire-and-forget: silently no-ops when logged out or on any failure; a missed
 * write costs one day of streak, never breaks the surface that called it.
 */
export async function recordDailyCompletion(surface: DailySurface): Promise<void> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.rpc('record_daily_completion', { p_surface: surface });
  } catch {
    // never throw into a game/vote flow
  }
}

/**
 * Record a debate completion only if the voted pair IS today's daily debate —
 * the vote hook is shared by every matchup surface (compare pages vote on
 * arbitrary pairs), so the daily check lives here, against the cached
 * daily_debate row. Pair order-insensitive (daily_debate stores a <= b).
 */
export async function recordDebateCompletionIfDaily(
  heroAId: string,
  heroBId: string,
): Promise<void> {
  try {
    const today = await getDailyDebate(todayIso());
    if (!today) return;
    const voted = [heroAId, heroBId].sort();
    const daily = [today.heroAId, today.heroBId].sort();
    if (voted[0] === daily[0] && voted[1] === daily[1]) {
      await recordDailyCompletion('debate');
    }
  } catch {
    /* fire-and-forget */
  }
}

/** Same guard for the team battle: only today's deterministic pair counts. */
export async function recordTeamBattleCompletionIfDaily(
  teamAId: string,
  teamBId: string,
): Promise<void> {
  try {
    const today = await getTodaysTeamBattle();
    if (!today) return;
    const voted = [teamAId, teamBId].sort();
    const daily = [today.teamA.id, today.teamB.id].sort();
    if (voted[0] === daily[0] && voted[1] === daily[1]) {
      await recordDailyCompletion('team_battle');
    }
  } catch {
    /* fire-and-forget */
  }
}

/** The signed-in streak + today's per-surface completion. EMPTY when logged out/error. */
export async function getMyDailyStreak(): Promise<DailyStreak> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return EMPTY;
    const { data, error } = await supabase.rpc('get_my_daily_streak');
    if (error || !data) return EMPTY;
    const json = data as unknown as DailyStreak;
    return {
      current: json.current ?? 0,
      longest: json.longest ?? 0,
      today: {
        puzzle: json.today?.puzzle ?? false,
        debate: json.today?.debate ?? false,
        team_battle: json.today?.team_battle ?? false,
      },
    };
  } catch {
    return EMPTY;
  }
}
