// __tests__/lib/db/heroes.test.ts
import {
  getHeroById,
  searchHeroes,
  heroRowToCharacterData,
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
  const chainMethods = ['select', 'eq', 'ilike', 'not', 'order', 'limit', 'single'];
  const chain: Record<string, unknown> = {};
  chainMethods.forEach((m) => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });

  // then() makes the whole chain awaitable (used by searchHeroes).
  // References `mockResolveWith` — allowed because it starts with "mock".
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(mockResolveWith).then(resolve);

  const mockFrom = jest.fn().mockReturnValue(chain);

  return {
    supabase: { from: mockFrom },
    // Expose internals so tests can reset mocks without re-building
    __chain: chain,
    __mockFrom: mockFrom,
  };
});

// Retrieve mock internals once (these references stay stable across tests)
const { __chain: chain, __mockFrom: mockFrom } = jest.requireMock(
  '../../../src/lib/supabase',
) as { __chain: Record<string, jest.Mock>; __mockFrom: jest.Mock };

const chainMethods = ['select', 'eq', 'ilike', 'not', 'order', 'limit'];

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
    expect(chain.ilike).toHaveBeenCalledWith('name', '%spider%');
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
    expect(data.details.summary).toBe('A bite from a radioactive spider gave Peter Parker amazing abilities.');
    expect(data.firstIssue?.imageUrl).toBe('https://cdn.example.com/issue.jpg');
  });

  it('returns null firstIssue when first_issue_image_url is null', () => {
    const data = heroRowToCharacterData({ ...hero, first_issue_image_url: null });
    expect(data.firstIssue).toBeNull();
  });
});
