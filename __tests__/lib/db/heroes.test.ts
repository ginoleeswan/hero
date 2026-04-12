// __tests__/lib/db/heroes.test.ts
import {
  getHeroById,
  searchHeroes,
  heroRowToCharacterData,
  getAntiHeroes,
  getHeroesByPublisher,
  getHeroesByStatRanking,
  type Hero,
} from '../../../src/lib/db/heroes';

// ─── Mock Supabase ────────────────────────────────────────────────────────────
//
// Supabase's query builder is "thenable" — it can be both chained and awaited.
// We replicate this by adding a `then` method to the chain object so that
// `await q` resolves with whatever `mockResolveWith` was set to last.
//
// Note: babel-preset-expo does not hoist `const mock*` variables declared
// outside the factory, so we build the mock inline and expose internals
// via the returned module object. Variables accessed inside the factory must
// either be prefixed with `mock` or be built-ins — hence `mockResolveWith`.
//

// eslint-disable-next-line prefer-const
let mockResolveWith: { data: unknown; error: unknown } = { data: null, error: null };

jest.mock('../../../src/lib/supabase', () => {
  const chainMethods = ['select', 'eq', 'gte', 'lte', 'neq', 'or', 'ilike', 'not', 'order', 'limit', 'single'];
  const chain: Record<string, unknown> = {};
  chainMethods.forEach((m) => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });

  // then() makes the whole chain awaitable (used by searchHeroes).
  // References `mockResolveWith` — allowed because it starts with "mock".
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(mockResolveWith).then(resolve);

  const mockFrom = jest.fn().mockReturnValue(chain);

  return {
    supabase: { from: mockFrom },
    // Expose internals so tests can reset mocks without re-building
    __chain: chain,
    __mockFrom: mockFrom,
  };
});

// Retrieve mock internals once (these references stay stable across tests)
const { __chain: chain, __mockFrom: mockFrom } = jest.requireMock('../../../src/lib/supabase') as {
  __chain: Record<string, jest.Mock>;
  __mockFrom: jest.Mock;
};

const chainMethods = ['select', 'eq', 'gte', 'lte', 'neq', 'or', 'ilike', 'not', 'order', 'limit'];

beforeEach(() => {
  jest.clearAllMocks();
  chainMethods.forEach((m) => chain[m].mockReturnValue(chain));
  chain.single.mockImplementation(() => Promise.resolve(mockResolveWith));
  mockFrom.mockReturnValue(chain);
  mockResolveWith = { data: null, error: null };
});

// ─── getHeroById ─────────────────────────────────────────────────────────────

describe('getHeroById', () => {
  it('returns the hero when found', async () => {
    const hero = { id: '620', name: 'Spider-Man', enriched_at: '2026-04-04T00:00:00Z' };
    mockResolveWith = { data: hero, error: null };

    const result = await getHeroById('620');
    expect(result).toEqual(hero);
    expect(mockFrom).toHaveBeenCalledWith('heroes');
    expect(chain.eq).toHaveBeenCalledWith('id', '620');
  });

  it('returns null when hero not found', async () => {
    mockResolveWith = { data: null, error: null };
    const result = await getHeroById('999');
    expect(result).toBeNull();
  });
});

// ─── searchHeroes ─────────────────────────────────────────────────────────────

describe('searchHeroes', () => {
  it('queries by name when query is non-empty', async () => {
    mockResolveWith = { data: [], error: null };
    await searchHeroes('spider', 'All');
    expect(chain.or).toHaveBeenCalledWith('name.ilike.%spider%,full_name.ilike.%spider%');
  });

  it('does not add ilike name filter when query is empty', async () => {
    mockResolveWith = { data: [], error: null };
    await searchHeroes('', 'All');
    expect(chain.ilike).not.toHaveBeenCalled();
  });

  it('filters by Marvel publisher', async () => {
    mockResolveWith = { data: [], error: null };
    await searchHeroes('', 'Marvel');
    expect(chain.ilike).toHaveBeenCalledWith('publisher', '%marvel%');
  });

  it('filters by DC publisher', async () => {
    mockResolveWith = { data: [], error: null };
    await searchHeroes('', 'DC');
    expect(chain.ilike).toHaveBeenCalledWith('publisher', '%dc%');
  });

  it('excludes Marvel and DC for Other filter', async () => {
    mockResolveWith = { data: [], error: null };
    await searchHeroes('', 'Other');
    expect(chain.not).toHaveBeenCalledWith('publisher', 'ilike', '%marvel%');
    expect(chain.not).toHaveBeenCalledWith('publisher', 'ilike', '%dc%');
  });

  it('throws on Supabase error', async () => {
    mockResolveWith = { data: null, error: { message: 'DB error' } };
    await expect(searchHeroes('', 'All')).rejects.toThrow('DB error');
  });
});

// ─── heroRowToCharacterData ──────────────────────────────────────────────────

describe('heroRowToCharacterData', () => {
  const hero = {
    id: '620',
    name: 'Spider-Man',
    category: 'popular',
    publisher: 'Marvel Comics',
    image_url: 'https://cdn.example.com/lg.jpg',
    image_md_url: 'https://cdn.example.com/md.jpg',
    intelligence: 90,
    strength: 55,
    speed: 67,
    durability: 75,
    power: 74,
    combat: 85,
    full_name: 'Peter Parker',
    alter_egos: 'No alter egos found.',
    aliases: ['Spidey', 'Web-Slinger'],
    place_of_birth: 'New York',
    first_appearance: 'Amazing Fantasy #15',
    alignment: 'good',
    gender: 'Male',
    race: 'Human',
    height_imperial: "5'10",
    height_metric: '178 cm',
    weight_imperial: '167 lb',
    weight_metric: '76 kg',
    eye_color: 'Hazel',
    hair_color: 'Brown',
    occupation: 'Freelance photographer',
    base: 'New York',
    group_affiliation: 'Avengers',
    relatives: 'Richard Parker (father)',
    summary: 'A bite from a radioactive spider gave Peter Parker amazing abilities.',
    first_issue_image_url: 'https://cdn.example.com/issue.jpg',
    comicvine_enriched_at: '2026-04-04T00:00:00Z',
    enriched_at: '2026-04-04T00:00:00Z',
    portrait_url: 'https://storage.example.com/portraits/620.jpg',
  } satisfies Hero;

  it('maps powerstats to string values', () => {
    const data = heroRowToCharacterData(hero);
    expect(data.stats.powerstats.intelligence).toBe('90');
    expect(data.stats.powerstats.strength).toBe('55');
  });

  it('maps null powerstats to "0"', () => {
    const data = heroRowToCharacterData({ ...hero, intelligence: null });
    expect(data.stats.powerstats.intelligence).toBe('0');
  });

  it('maps biography fields with hyphenated keys', () => {
    const data = heroRowToCharacterData(hero);
    expect(data.stats.biography['full-name']).toBe('Peter Parker');
    expect(data.stats.biography['place-of-birth']).toBe('New York');
    expect(data.stats.biography.aliases).toEqual(['Spidey', 'Web-Slinger']);
  });

  it('maps appearance fields with hyphenated keys', () => {
    const data = heroRowToCharacterData(hero);
    expect(data.stats.appearance['eye-color']).toBe('Hazel');
    expect(data.stats.appearance.height).toEqual(["5'10", '178 cm']);
  });

  it('maps comicvine fields', () => {
    const data = heroRowToCharacterData(hero);
    expect(data.details.summary).toBe(
      'A bite from a radioactive spider gave Peter Parker amazing abilities.',
    );
    expect(data.firstIssue?.imageUrl).toBe('https://cdn.example.com/issue.jpg');
  });

  it('returns null firstIssue when first_issue_image_url is null', () => {
    const data = heroRowToCharacterData({ ...hero, first_issue_image_url: null });
    expect(data.firstIssue).toBeNull();
  });

  it('uses portrait_url as the image url when set', () => {
    const data = heroRowToCharacterData(hero);
    expect(data.stats.image.url).toBe('https://storage.example.com/portraits/620.jpg');
  });

  it('falls back to image_url when portrait_url is null', () => {
    const data = heroRowToCharacterData({ ...hero, portrait_url: null });
    expect(data.stats.image.url).toBe('https://cdn.example.com/lg.jpg');
  });
});

// ─── getAntiHeroes ────────────────────────────────────────────────────────────

describe('getAntiHeroes', () => {
  it('filters by neutral alignment', async () => {
    mockResolveWith = { data: [], error: null };
    await getAntiHeroes();
    expect(chain.ilike).toHaveBeenCalledWith('alignment', '%neutral%');
  });

  it('applies limit', async () => {
    mockResolveWith = { data: [], error: null };
    await getAntiHeroes(5);
    expect(chain.limit).toHaveBeenCalledWith(5);
  });

  it('throws on error', async () => {
    mockResolveWith = { data: null, error: { message: 'fail' } };
    await expect(getAntiHeroes()).rejects.toThrow('fail');
  });
});

// ─── getHeroesByPublisher ──────────────────────────────────────────────────────

describe('getHeroesByPublisher', () => {
  it('filters by marvel publisher', async () => {
    mockResolveWith = { data: [], error: null };
    await getHeroesByPublisher('marvel');
    expect(chain.ilike).toHaveBeenCalledWith('publisher', '%marvel%');
  });

  it('filters by dc publisher', async () => {
    mockResolveWith = { data: [], error: null };
    await getHeroesByPublisher('dc');
    expect(chain.ilike).toHaveBeenCalledWith('publisher', '%dc%');
  });

  it('throws on error', async () => {
    mockResolveWith = { data: null, error: { message: 'fail' } };
    await expect(getHeroesByPublisher('marvel')).rejects.toThrow('fail');
  });
});

// ─── getHeroesByStatRanking ───────────────────────────────────────────────────

describe('getHeroesByStatRanking', () => {
  it('orders by strength descending', async () => {
    mockResolveWith = { data: [], error: null };
    await getHeroesByStatRanking('strength');
    expect(chain.order).toHaveBeenCalledWith('strength', { ascending: false });
  });

  it('orders by intelligence descending', async () => {
    mockResolveWith = { data: [], error: null };
    await getHeroesByStatRanking('intelligence');
    expect(chain.order).toHaveBeenCalledWith('intelligence', { ascending: false });
  });

  it('excludes null stat values', async () => {
    mockResolveWith = { data: [], error: null };
    await getHeroesByStatRanking('strength');
    expect(chain.not).toHaveBeenCalledWith('strength', 'is', null);
  });

  it('throws on error', async () => {
    mockResolveWith = { data: null, error: { message: 'fail' } };
    await expect(getHeroesByStatRanking('strength')).rejects.toThrow('fail');
  });
});

// ─── heroRowToCharacterData — powers mapping ──────────────────────────────────

import type { Tables } from '../../../src/types/database.generated';

type HeroRow = Tables<'heroes'>;

const baseHero: HeroRow = {
  id: '1',
  name: 'Test Hero',
  powers: null,
  intelligence: 80,
  strength: 90,
  speed: 70,
  durability: 85,
  power: 75,
  combat: 80,
  full_name: 'Test T. Hero',
  alter_egos: null,
  aliases: [],
  place_of_birth: null,
  first_appearance: null,
  publisher: 'Marvel',
  alignment: 'good',
  gender: 'Male',
  race: 'Human',
  height_imperial: "6'2\"",
  height_metric: '188 cm',
  weight_imperial: '200 lb',
  weight_metric: '91 kg',
  eye_color: 'Blue',
  hair_color: 'Black',
  occupation: 'Hero',
  base: 'New York',
  group_affiliation: null,
  relatives: null,
  summary: null,
  image_url: null,
  image_md_url: null,
  portrait_url: null,
  first_issue_image_url: null,
  category: null,
  enriched_at: null,
  comicvine_enriched_at: null,
};

describe('heroRowToCharacterData — powers mapping', () => {
  it('maps powers array to details.powers', () => {
    const hero: HeroRow = { ...baseHero, powers: ['Flight', 'Super Strength'] };
    const result = heroRowToCharacterData(hero);
    expect(result.details.powers).toEqual(['Flight', 'Super Strength']);
  });

  it('maps null powers to null', () => {
    const hero: HeroRow = { ...baseHero, powers: null };
    const result = heroRowToCharacterData(hero);
    expect(result.details.powers).toBeNull();
  });
});

// ─── getHeroesByPowerRange ────────────────────────────────────────────────────

import { getHeroesByPowerRange } from '../../../src/lib/db/heroes';

describe('getHeroesByPowerRange', () => {
  it('returns an array (even empty) without throwing', async () => {
    const result = await getHeroesByPowerRange(200, 350, '70');
    expect(Array.isArray(result)).toBe(true);
  });
});
