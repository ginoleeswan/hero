import { resolveBattleRoute } from '../../src/lib/battleRoute';

describe('resolveBattleRoute', () => {
  it('returns null when a side is empty', () => {
    expect(resolveBattleRoute([], ['x'])).toBeNull();
    expect(resolveBattleRoute(['x'], [])).toBeNull();
  });

  it('routes 1v1 to the existing compare arena', () => {
    expect(resolveBattleRoute(['superman'], ['batman'])).toBe('/compare/superman/batman');
  });

  it('routes any team size to the draft route with both rosters', () => {
    expect(resolveBattleRoute(['a', 'b', 'c'], ['x', 'y'])).toBe('/versus/team/draft?a=a%2Cb%2Cc&b=x%2Cy');
  });

  it('treats N-vs-1 as a team battle (not the 1v1 arena)', () => {
    expect(resolveBattleRoute(['a', 'b'], ['x'])).toBe('/versus/team/draft?a=a%2Cb&b=x');
  });
});
