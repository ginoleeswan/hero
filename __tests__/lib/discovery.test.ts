import {
  heroPowerTotal,
  buildDreamMatches,
  buildGoliathMatches,
  buildTeamMatches,
} from '../../src/lib/discovery';
import type { Hero } from '../../src/lib/db/heroes';
import type { FeaturedTeam } from '../../src/lib/db/teams';

const hero = (id: string, publisher: string | null, total: number): Hero =>
  ({
    id,
    name: id,
    image_url: null,
    portrait_url: null,
    publisher,
    intelligence: total,
    strength: 0,
    speed: 0,
    durability: 0,
    power: 0,
    combat: 0,
  }) as unknown as Hero;

const team = (id: string): FeaturedTeam => ({
  id,
  name: id,
  publisher: 'Marvel',
  logo_url: null,
  popularity: 1,
});

describe('heroPowerTotal', () => {
  it('sums the six stats and treats null as 0', () => {
    expect(heroPowerTotal({ intelligence: 5, strength: 3 } as unknown as Hero)).toBe(8);
    expect(heroPowerTotal({} as unknown as Hero)).toBe(0);
  });
});

describe('buildDreamMatches', () => {
  it('only pairs cross-publisher (Marvel vs DC), never same-side', () => {
    const pool = [
      hero('m1', 'Marvel Comics', 50),
      hero('d1', 'DC Comics', 50),
      hero('m2', 'Marvel Comics', 40),
      hero('d2', 'DC Comics', 40),
      hero('o1', 'Image', 90),
    ];
    const out = buildDreamMatches(pool, 5);
    expect(out).toHaveLength(2);
    out.forEach((m) => {
      expect(m.a.id[0]).toBe('m');
      expect(m.b.id[0]).toBe('d');
    });
  });
  it('hides (empty) when one publisher is missing', () => {
    expect(buildDreamMatches([hero('m1', 'Marvel', 1), hero('m2', 'Marvel', 1)], 5)).toEqual([]);
  });
});

describe('buildGoliathMatches', () => {
  it('pairs an underdog (low total) with a heavyweight (high total)', () => {
    const pool = [hero('weak', 'Marvel', 10), hero('mid', 'Marvel', 50), hero('strong', 'DC', 100)];
    const [m] = buildGoliathMatches(pool, 1);
    expect(m.a.id).toBe('weak'); // underdog first
    expect(m.b.id).toBe('strong'); // heavyweight
  });
  it('never self-pairs and is stable for the same input', () => {
    const pool = [hero('a', 'Marvel', 90), hero('b', 'DC', 10)];
    const out = buildGoliathMatches(pool, 5);
    expect(out).toHaveLength(1);
    expect(out[0].a.id).not.toBe(out[0].b.id);
    expect(buildGoliathMatches(pool, 5)).toEqual(out);
  });
});

describe('buildTeamMatches', () => {
  it('yields distinct consecutive team pairs', () => {
    const out = buildTeamMatches([team('avengers'), team('jla'), team('xmen'), team('brood')], 5);
    expect(out.map((m) => [m.a.id, m.b.id])).toEqual([
      ['avengers', 'jla'],
      ['xmen', 'brood'],
    ]);
  });
});
