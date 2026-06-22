import { resolveTeamBattle, type TeamSide, type SynergyBreakdown } from '../../src/lib/teamBattle';

const noSyn: SynergyBreakdown = {
  teammate_links: { count: 0, max: 0, pct: 0 },
  shared_affiliation: { team: null, coverage: 0, pct: 0 },
  role_balance: { archetypes: 0, pct: 0 },
  total_pct: 0,
};
const hero = (id: string, s: number) => ({
  id,
  name: id,
  intelligence: s,
  strength: s,
  speed: s,
  durability: s,
  power: s,
  combat: s,
});
const side = (ids: [string, number][], total_pct = 0): TeamSide => ({
  team: { id: 'x', name: 'X', publisher: null, logo_url: null },
  roster: ids.map(([id, s]) => hero(id, s)),
  synergy: { ...noSyn, total_pct },
});

describe('resolveTeamBattle', () => {
  it('returns 6 stat rows', () => {
    const r = resolveTeamBattle(side([['a', 80]]), side([['b', 60]]));
    expect(r.stats).toHaveLength(6);
  });

  it('averages stats — a 3-roster of 60s does not beat a solo 80 on raw stats', () => {
    const r = resolveTeamBattle(
      side([['s', 80]]),
      side([
        ['a', 60],
        ['b', 60],
        ['c', 60],
      ]),
    );
    expect(r.stats[0].winner).toBe('A'); // 80 avg vs 60 avg
    expect(r.winsA).toBe(6);
  });

  it('synergy boost can flip a close raw-stat deficit', () => {
    const r = resolveTeamBattle(side([['a', 70]], 0), side([['b', 72]], 0.2));
    expect(r.splitB).toBeGreaterThan(r.splitA); // B's 20% synergy overcomes the 2pt gap
  });

  it('split sums to ~100', () => {
    const r = resolveTeamBattle(side([['a', 70]], 0.1), side([['b', 50]], 0));
    expect(r.splitA + r.splitB).toBe(100);
  });

  it('treats null stats as 0', () => {
    const a: TeamSide = {
      team: null,
      roster: [
        {
          id: 'a',
          name: 'a',
          intelligence: null,
          strength: null,
          speed: null,
          durability: null,
          power: null,
          combat: null,
        },
      ],
      synergy: noSyn,
    };
    const r = resolveTeamBattle(a, side([['b', 10]]));
    expect(r.winsB).toBe(6);
  });
});
