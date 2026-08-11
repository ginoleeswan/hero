import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabase';
import { getDailyDebate, todayIso } from './dailyDebate';
import { getTodaysTeamBattle } from './teams';

// Daily plumbing, in two layers.
//
// The STREAK is a signed-in, server-owned calendar: completing any daily
// surface counts the day (user_daily_completions), and get_my_daily_streak
// computes the run. There is no cross-surface anonymous identity, so a streak
// needs an account — that part has always been true.
//
// TODAY'S TICKS are not. The Arena's ledger shows which of the three dailies
// are done, and it was reading them from that same signed-in RPC — so a logged
// out player saw three permanently OPEN rows no matter what they played. That
// is the app contradicting itself: voting is deliberately anon-friendly (see
// useMatchupVote's cold-launch rule — no sign-up wall at the vote moment), and
// then the screen refused to acknowledge the vote it had just accepted.
//
// So completions are ALSO mirrored to a local, date-stamped key, written
// whether or not there is a session, and merged into the read. Anonymous
// players get honest ticks for the day; signed-in players get the same ticks
// without waiting for a refetch, since the mirror is written by the same call
// that hits the server.
//
// The mirror is deliberately dumb: one boolean per surface per UTC date, never
// cleaned up (a stale key is ~30 bytes and reads false on any other date).

export type DailySurface = 'puzzle' | 'debate' | 'team_battle';

export interface DailyStreak {
  current: number;
  longest: number;
  today: Record<DailySurface, boolean>;
  /** False when logged out: today's ticks are real, but no streak is being
   *  kept. Lets a surface offer an account instead of showing a dead zero. */
  tracked: boolean;
}

const EMPTY: DailyStreak = {
  current: 0,
  longest: 0,
  today: { puzzle: false, debate: false, team_battle: false },
  tracked: false,
};

const SURFACES: DailySurface[] = ['puzzle', 'debate', 'team_battle'];

/** UTC, to match the server's `current_date` and the daily rotation. */
function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

const localKey = (surface: DailySurface) => `dailyDone:${surface}:${utcDay()}`;

// Mounted readers, so a completion lights its row immediately instead of on
// the next screen focus. Voting happens ON the Arena — without this the tick
// only appeared if you left the tab and came back.
type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeToDailies(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Record a completion for TODAY (UTC — the server stamps current_date itself).
 * Fire-and-forget: the server write silently no-ops when logged out or on any
 * failure; a missed write costs one day of streak, never breaks the surface
 * that called it. The local tick is written either way.
 */
export async function recordDailyCompletion(surface: DailySurface): Promise<void> {
  try {
    await AsyncStorage.setItem(localKey(surface), '1');
    for (const fn of listeners) fn();
  } catch {
    /* a missing tick is cosmetic */
  }
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

/** Today's local ticks — the whole answer when logged out, and the immediate
 *  half of it when signed in. */
async function readLocalTicks(): Promise<Record<DailySurface, boolean>> {
  const out = { puzzle: false, debate: false, team_battle: false };
  try {
    const pairs = await AsyncStorage.multiGet(SURFACES.map(localKey));
    for (let i = 0; i < SURFACES.length; i++) out[SURFACES[i]] = pairs[i]?.[1] === '1';
  } catch {
    /* fall through to all-false */
  }
  return out;
}

/** The streak (signed-in) plus today's per-surface completion (everyone). */
export async function getMyDailyStreak(): Promise<DailyStreak> {
  const local = await readLocalTicks();
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return { ...EMPTY, today: local };
    const { data, error } = await supabase.rpc('get_my_daily_streak');
    if (error || !data) return { ...EMPTY, today: local, tracked: true };
    const json = data as unknown as DailyStreak;
    // OR, not replace: the server is authoritative about the calendar, the
    // mirror is authoritative about the last few seconds.
    return {
      current: json.current ?? 0,
      longest: json.longest ?? 0,
      today: {
        puzzle: local.puzzle || (json.today?.puzzle ?? false),
        debate: local.debate || (json.today?.debate ?? false),
        team_battle: local.team_battle || (json.today?.team_battle ?? false),
      },
      tracked: true,
    };
  } catch {
    return { ...EMPTY, today: local };
  }
}
