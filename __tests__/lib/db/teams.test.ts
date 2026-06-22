import { pickDailyTeamPair, type FeaturedTeam } from '../../../src/lib/db/teams';

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
