import { pickDailyTeamPair, searchTeams, getTeamById, type FeaturedTeam } from '../../../src/lib/db/teams';
import { supabase } from '../../../src/lib/supabase';

jest.mock('../../../src/lib/supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));

function mockSearch(rows: unknown, error: unknown = null) {
  const limit = jest.fn().mockResolvedValue({ data: rows, error });
  const order = jest.fn(() => ({ limit }));
  const ilike = jest.fn(() => ({ order }));
  const select = jest.fn(() => ({ ilike }));
  (supabase.from as jest.Mock).mockReturnValue({ select });
  return { select, ilike, order, limit };
}

function mockSingle(row: unknown, error: unknown = null) {
  const single = jest.fn().mockResolvedValue({ data: row, error });
  const eq = jest.fn(() => ({ single }));
  const select = jest.fn(() => ({ eq }));
  (supabase.from as jest.Mock).mockReturnValue({ select });
  return { select, eq, single };
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

  it('queries teams by ILIKE on name, ordered by popularity', async () => {
    const m = mockSearch([
      { id: 't1', name: 'Avengers', publisher: 'Marvel', logo_url: null, member_count: 145 },
    ]);
    const out = await searchTeams('aveng', 6);
    expect(supabase.from).toHaveBeenCalledWith('teams');
    expect(m.ilike).toHaveBeenCalledWith('name', '%aveng%');
    expect(m.limit).toHaveBeenCalledWith(6);
    expect(out[0]).toEqual({
      id: 't1',
      name: 'Avengers',
      publisher: 'Marvel',
      logo_url: null,
      member_count: 145,
    });
  });

  it('degrades to [] on error', async () => {
    mockSearch(null, { message: 'boom' });
    expect(await searchTeams('x')).toEqual([]);
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
