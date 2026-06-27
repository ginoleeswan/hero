import { supabase } from '../supabase';
import type { SynergyBreakdown, RosterHero } from '../teamBattle';

export interface FeaturedTeam {
  id: string;
  name: string;
  publisher: string | null;
  logo_url: string | null;
  popularity: number;
}
export interface TodaysTeamBattle {
  teamA: FeaturedTeam;
  teamB: FeaturedTeam;
}
export interface TeamTally {
  votesA: number;
  votesB: number;
  total: number;
  myPick: string | null;
}

// Same daily-seed convention as src/lib/matchup.ts: same pair all day, new tomorrow.
function dailySeed(d = new Date()): number {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

/** Deterministically pick two distinct featured teams for a day. Pure + tested. */
export function pickDailyTeamPair(
  teams: FeaturedTeam[],
  seed = dailySeed(),
): TodaysTeamBattle | null {
  if (teams.length < 2) return null;
  const iA = seed % teams.length;
  let iB = (seed * 7 + 3) % teams.length;
  if (iB === iA) iB = (iB + 1) % teams.length;
  return { teamA: teams[iA], teamB: teams[iB] };
}

export async function getFeaturedTeams(): Promise<FeaturedTeam[]> {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, publisher, logo_url, popularity')
    .eq('is_featured', true)
    .order('popularity', { ascending: false, nullsFirst: false })
    .limit(40);
  if (error) {
    console.warn('[getFeaturedTeams] error:', error.message);
    return [];
  }
  return (data ?? []) as FeaturedTeam[];
}

export async function getTodaysTeamBattle(): Promise<TodaysTeamBattle | null> {
  const teams = await getFeaturedTeams();
  return pickDailyTeamPair(teams);
}

export async function getTeamRoster(teamId: string, limit = 5): Promise<RosterHero[]> {
  const { data, error } = await supabase.rpc('get_team_roster', {
    p_team_id: teamId,
    p_limit: limit,
  });
  if (error) {
    console.warn('[getTeamRoster] error:', error.message);
    return [];
  }
  return (data ?? []) as RosterHero[];
}

export interface TeamSummary {
  id: string;
  name: string;
  publisher: string | null;
  logo_url: string | null;
  member_count: number;
}

export type TeamSearchResult = TeamSummary;

const TEAM_SUMMARY_COLS = 'id, name, publisher, logo_url, member_count';

const teamNorm = (s: string) => s.trim().toLowerCase();

/**
 * Re-rank a popularity-ordered team pool by name relevance: exact > prefix >
 * contains, popularity preserved within a tier (stable sort). Pure + tested.
 */
export function rankTeams(teams: TeamSearchResult[], query: string): TeamSearchResult[] {
  const q = teamNorm(query);
  if (!q) return teams;
  const tier = (name: string) => {
    const n = teamNorm(name);
    if (n === q) return 0;
    if (n.startsWith(q)) return 1;
    return 2;
  };
  return teams
    .map((t, i) => ({ t, i, r: tier(t.name) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.t);
}

/**
 * Team search for the unified search surface. Fetches a popularity-ordered pool of
 * ILIKE matches (dropping ≤1-member junk like one-off "teams"), then re-ranks by
 * name relevance so exact/prefix matches lead. Empty query short-circuits; degrades
 * to [] so a DB hiccup never blanks the other result sections.
 */
export async function searchTeams(query: string, limit = 6): Promise<TeamSearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const { data, error } = await supabase
    .from('teams')
    .select(TEAM_SUMMARY_COLS)
    .ilike('name', `%${q}%`)
    .gte('member_count', 2)
    .order('popularity', { ascending: false, nullsFirst: false })
    .limit(40);
  if (error) {
    console.warn('[searchTeams] error:', error.message);
    return [];
  }
  return rankTeams((data ?? []) as TeamSearchResult[], q).slice(0, limit);
}

/**
 * Resolve team names (e.g. a hero's `teams[]` affiliations) to their team rows,
 * so the affiliation chips on a character page can link to /team/[id]. Names with
 * no matching team simply aren't returned (those chips stay non-tappable text).
 */
export async function getTeamsByNames(names: string[]): Promise<TeamSummary[]> {
  if (names.length === 0) return [];
  const { data, error } = await supabase
    .from('teams')
    .select(TEAM_SUMMARY_COLS)
    .in('name', names);
  if (error) {
    console.warn('[getTeamsByNames] error:', error.message);
    return [];
  }
  return (data ?? []) as TeamSummary[];
}

/** One team's summary for the /team/[id] page header. null when not found. */
export async function getTeamById(id: string): Promise<TeamSummary | null> {
  const { data, error } = await supabase
    .from('teams')
    .select(TEAM_SUMMARY_COLS)
    .eq('id', id)
    .single();
  if (error && error.code !== 'PGRST116') {
    console.warn('[getTeamById] error:', error.message);
  }
  return (data as TeamSummary | null) ?? null;
}


const EMPTY_SYNERGY: SynergyBreakdown = {
  teammate_links: { count: 0, max: 0, pct: 0 },
  shared_affiliation: { team: null, coverage: 0, pct: 0 },
  role_balance: { archetypes: 0, pct: 0 },
  total_pct: 0,
};

export async function getTeamSynergy(heroIds: string[]): Promise<SynergyBreakdown> {
  if (heroIds.length < 2) return EMPTY_SYNERGY;
  const { data, error } = await supabase.rpc('get_team_synergy', { p_hero_ids: heroIds });
  if (error || !data) {
    console.warn('[getTeamSynergy] error:', error?.message);
    return EMPTY_SYNERGY;
  }
  return data as unknown as SynergyBreakdown;
}

function toTally(data: unknown): TeamTally {
  const d = (data ?? {}) as {
    votes_a?: number;
    votes_b?: number;
    total?: number;
    my_pick?: string | null;
  };
  return {
    votesA: d.votes_a ?? 0,
    votesB: d.votes_b ?? 0,
    total: d.total ?? 0,
    myPick: d.my_pick ?? null,
  };
}

export async function getTeamBattleTally(a: string, b: string): Promise<TeamTally | null> {
  const { data, error } = await supabase.rpc('get_team_battle_tally', { p_a: a, p_b: b });
  if (error) {
    console.warn('[getTeamBattleTally] error:', error.message);
    return null;
  }
  return toTally(data);
}

export async function castTeamBattleVote(
  a: string,
  b: string,
  picked: string,
): Promise<TeamTally | null> {
  const { data, error } = await supabase.rpc('cast_team_battle_vote', {
    p_a: a,
    p_b: b,
    p_picked: picked,
  });
  if (error) {
    console.warn('[castTeamBattleVote] error:', error.message);
    return null;
  }
  return toTally(data);
}

const DRAFT_COLS =
  'id, name, portrait_url, image_url, intelligence, strength, speed, durability, power, combat';

/**
 * Fetch up to five heroes by id for a drafted battle side, returned in the same
 * order as `ids` (Postgres `in()` does not preserve order). Missing ids are
 * dropped. Degrades to `[]` on error — the clash page hides an empty side.
 */
export async function getDraftRoster(ids: string[]): Promise<RosterHero[]> {
  const wanted = ids.slice(0, 5);
  if (wanted.length === 0) return [];
  const { data, error } = await supabase.from('heroes').select(DRAFT_COLS).in('id', wanted);
  if (error) {
    console.warn('[getDraftRoster] error:', error.message);
    return [];
  }
  const byId = new Map((data ?? []).map((h) => [(h as RosterHero).id, h as unknown as RosterHero]));
  return wanted.map((id) => byId.get(id)).filter((h): h is RosterHero => !!h);
}
