import {
  pickDailyTeamPair,
  searchTeams,
  rankTeams,
  getTeamById,
  getTeamsByNames,
  type FeaturedTeam,
  type TeamSearchResult,
} from '../../../src/lib/db/teams';
import { supabase } from '../../../src/lib/supabase';

jest.mock('../../../src/lib/supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));

function mockSearch(rows: unknown, error: unknown = null) {
  const limit = jest.fn().mockResolvedValue({ data: rows, error });
  const order = jest.fn(() => ({ limit }));
  const gte = jest.fn(() => ({ order }));
  const ilike = jest.fn(() => ({ gte }));
  const select = jest.fn(() => ({ ilike }));
  (supabase.from as jest.Mock).mockReturnValue({ select });
  return { select, ilike, gte, order, limit };
}

const team = (name: string, popularity = 1, member_count = 5): TeamSearchResult => ({
  id: name,
  name,
  publisher: null,
  logo_url: null,
  member_count,
});

function mockSingle(row: unknown, error: unknown = null) {
  const single = jest.fn().mockResolvedValue({ data: row, error });
  const eq = jest.fn(() => ({ single }));
  const select = jest.fn(() => ({ eq }));
  (supabase.from as jest.Mock).mockReturnValue({ select });
  return { select, eq, single };
}

function mockIn(rows: unknown, error: unknown = null) {
  const inFn = jest.fn().mockResolvedValue({ data: rows, error });
  const select = jest.fn(() => ({ in: inFn }));
  (supabase.from as jest.Mock).mockReturnValue({ select });
  return { select, in: inFn };
}

const teams: FeaturedTeam[] = ['avengers', 'x-men', 'justice-league', 'teen-titans'].map(
  (id, i) => ({ id, name: id, publisher: null, logo_url: null, popularity: 100 - i }),
);

describe('pickDailyTeamPair', () => {
  it('returns null with fewer than 2 teams', () => {
    expect(pickDailyTeamPair([teams[0]])).toBeNull();
  });

  it('is deterministic for a given seed', () => {
    const a = pickDailyTeamPair(teams, 20260622);
    const b = pickDailyTeamPair(teams, 20260622);
    expect(a).toEqual(b);
  });

  it('never pairs a team with itself', () => {
    for (let s = 0; s < 50; s++) {
      const pair = pickDailyTeamPair(teams, 20260600 + s);
      expect(pair!.teamA.id).not.toEqual(pair!.teamB.id);
    }
  });

  it('changes the pair across consecutive days', () => {
    const d1 = pickDailyTeamPair(teams, 20260622);
    const d2 = pickDailyTeamPair(teams, 20260623);
    expect([d1!.teamA.id, d1!.teamB.id]).not.toEqual([d2!.teamA.id, d2!.teamB.id]);
  });
});

describe('searchTeams', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns [] for an empty query without hitting the DB', async () => {
    mockSearch([]);
    expect(await searchTeams('  ')).toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('queries by ILIKE, drops <2-member teams, then re-ranks + slices', async () => {
    // Pool comes back popularity-ordered; a contains-match leads but a prefix
    // match should win after re-ranking.
    const m = mockSearch([
      { id: 'c', name: 'Secret Avengers Society', publisher: null, logo_url: null, member_count: 90 },
      { id: 'p', name: 'Avengers', publisher: 'Marvel', logo_url: null, member_count: 145 },
    ]);
    const out = await searchTeams('aveng', 1);
    expect(supabase.from).toHaveBeenCalledWith('teams');
    expect(m.ilike).toHaveBeenCalledWith('name', '%aveng%');
    expect(m.gte).toHaveBeenCalledWith('member_count', 2);
    expect(m.limit).toHaveBeenCalledWith(40);
    // prefix match "Avengers" re-ranked above the popular contains-match, sliced to 1.
    expect(out.map((t) => t.id)).toEqual(['p']);
  });

  it('degrades to [] on error', async () => {
    mockSearch(null, { message: 'boom' });
    expect(await searchTeams('x')).toEqual([]);
  });
});

describe('rankTeams', () => {
  it('orders exact > prefix > contains', () => {
    const out = rankTeams(
      [team('Justice League of America'), team('League'), team('Injustice League')],
      'league',
    );
    expect(out.map((t) => t.name)).toEqual([
      'League', // exact
      'Justice League of America', // contains
      'Injustice League', // contains
    ]);
  });

  it('preserves input (popularity) order within a tier', () => {
    const out = rankTeams([team('Avengers A'), team('Avengers B')], 'aveng');
    expect(out.map((t) => t.name)).toEqual(['Avengers A', 'Avengers B']);
  });

  it('returns input unchanged for an empty query', () => {
    const input = [team('X'), team('Y')];
    expect(rankTeams(input, '  ')).toEqual(input);
  });
});

describe('getTeamById', () => {
  beforeEach(() => jest.clearAllMocks());

  it('maps a row to a TeamSummary', async () => {
    mockSingle({ id: 't1', name: 'X-Men', publisher: 'Marvel', logo_url: null, member_count: 284 });
    const t = await getTeamById('t1');
    expect(t?.name).toBe('X-Men');
    expect(t?.member_count).toBe(284);
  });

  it('returns null when missing', async () => {
    mockSingle(null, { code: 'PGRST116' });
    expect(await getTeamById('nope')).toBeNull();
  });
});

describe('getTeamsByNames', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns [] for an empty list without hitting the DB', async () => {
    mockIn([]);
    expect(await getTeamsByNames([])).toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('looks up teams by exact name', async () => {
    const m = mockIn([
      { id: 't1', name: 'Avengers', publisher: 'Marvel', logo_url: null, member_count: 145 },
    ]);
    const out = await getTeamsByNames(['Avengers', 'Unknown Club']);
    expect(supabase.from).toHaveBeenCalledWith('teams');
    expect(m.in).toHaveBeenCalledWith('name', ['Avengers', 'Unknown Club']);
    expect(out[0].id).toBe('t1');
  });

  it('degrades to [] on error', async () => {
    mockIn(null, { message: 'boom' });
    expect(await getTeamsByNames(['Avengers'])).toEqual([]);
  });
});
