// __tests__/lib/db/heroes.test.ts
import {
  getHeroById,
  searchHeroes,
  searchHeroesPage,
  getSearchIdleHeroes,
  heroRowToCharacterData,
  getAntiHeroes,
  getHeroesByPublisher,
  getHeroesByStatRanking,
  getTopHeroByStat,
  getPublisherCounts,
  getFirstAppearanceCovers,
  type Hero,
  type PublisherCounts,
} from '../../../src/lib/db/heroes';

// ─── heroRowToCharacterData — powers mapping ──────────────────────────────────

import type { Tables } from '../../../src/types/database.generated';

// ─── getHeroesByPowerRange ────────────────────────────────────────────────────

import { getHeroesByPowerRange } from '../../../src/lib/db/heroes';

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

let mockResolveWith: { data: unknown; error: unknown; count?: number | null } = {
  data: null,
  error: null,
};

jest.mock('../../../src/lib/supabase', () => {
  const chainMethods = [
    'select',
    'eq',
    'gte',
    'lte',
    'neq',
    'or',
    'ilike',
    'not',
    'order',
    'limit',
    'single',
  ];
  const chain: Record<string, unknown> = {};
  chainMethods.forEach((m) => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });

  // then() makes the whole chain awaitable (used by searchHeroes).
  // References `mockResolveWith` — allowed because it starts with "mock".
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(mockResolveWith).then(resolve);

  const mockFrom = jest.fn().mockReturnValue(chain);
  // rpc() is awaited directly (used by searchHeroes for non-empty queries).
  const mockRpc = jest.fn(() => Promise.resolve(mockResolveWith));

  return {
    supabase: { from: mockFrom, rpc: mockRpc },
    // Expose internals so tests can reset mocks without re-building
    __chain: chain,
    __mockFrom: mockFrom,
    __mockRpc: mockRpc,
  };
});

// Retrieve mock internals once (these references stay stable across tests)
const {
  __chain: chain,
  __mockFrom: mockFrom,
  __mockRpc: mockRpc,
} = jest.requireMock('../../../src/lib/supabase') as {
  __chain: Record<string, jest.Mock>;
  __mockFrom: jest.Mock;
  __mockRpc: jest.Mock;
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
  it('calls the search_heroes RPC with publisher + paging args', async () => {
    mockResolveWith = { data: [], error: null };
    await searchHeroes('spider', 'All', 50);
    expect(mockRpc).toHaveBeenCalledWith('search_heroes', {
      search_query: 'spider',
      publisher_filter: 'All',
      alignment_filter: 'All',
      result_limit: 50,
      result_offset: 0,
    });
  });

  it('passes the publisher filter through to the RPC', async () => {
    mockResolveWith = { data: [], error: null };
    await searchHeroes('', 'Marvel');
    expect(mockRpc).toHaveBeenCalledWith(
      'search_heroes',
      expect.objectContaining({ publisher_filter: 'Marvel' }),
    );
  });

  it('throws on Supabase error', async () => {
    mockResolveWith = { data: null, error: { message: 'DB error' } };
    await expect(searchHeroes('', 'All')).rejects.toThrow('DB error');
  });
});

describe('searchHeroesPage', () => {
  it('maps alignment + page to RPC limit/offset args', async () => {
    mockResolveWith = { data: [], error: null };
    await searchHeroesPage('', 'DC', 'Villains', 2, 30);
    expect(mockRpc).toHaveBeenCalledWith('search_heroes', {
      search_query: '',
      publisher_filter: 'DC',
      alignment_filter: 'bad',
      result_limit: 30,
      result_offset: 60,
    });
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
    comicvine_status: 'done',
    enriched_at: '2026-04-04T00:00:00Z',
    portrait_url: 'https://storage.example.com/portraits/620.jpg',
    portrait_blurhash: null,
    powers: null,
    description: null,
    origin: null,
    issue_count: null,
    creators: null,
    enemies: null,
    friends: null,
    movies: null,
    teams: null,
    ai_stats_status: null,
    comicvine_id: null,
    superhero_api_id: null,
    first_issue_data: null,
    first_issue_id: null,
    movie_count: null,
    powerstats_total: null,
    stats_source: null,
    issue_covers: null,
    gallery_enriched_at: null,
    wikidata_qid: null,
    wikidata_status: 'pending',
    wikidata_candidates: null,
    wikidata_enriched_at: null,
    narrative_status: 'pending',
    added_at: '2026-04-04T00:00:00Z',
    franchise: null,
    wikidata_sitelinks: null,
    fame_tier: 0,
    fame_rated_at: null,
    fame_rated_by: null,
    fame_score: null,
    fame_score_version: null,
    search_text: 'spider-man peter parker spidey web-slinger',
    enwiki_title: null,
    pageviews_week: null,
    pageviews_prev: null,
    pageviews_spike: null,
    pageviews_at: null,
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

type HeroRow = Tables<'heroes'>;

const baseHero: HeroRow = {
  id: '1',
  name: 'Test Hero',
  superhero_api_id: null,
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
  height_imperial: '6\'2"',
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
  portrait_blurhash: null,
  first_issue_image_url: null,
  category: null,
  enriched_at: null,
  comicvine_enriched_at: null,
  comicvine_status: null,
  description: null,
  origin: null,
  issue_count: null,
  creators: null,
  enemies: null,
  friends: null,
  movies: null,
  teams: null,
  ai_stats_status: null,
  comicvine_id: null,
  first_issue_data: null,
  first_issue_id: null,
  movie_count: null,
  powerstats_total: null,
  stats_source: null,
  issue_covers: null,
  gallery_enriched_at: null,
  wikidata_qid: null,
  wikidata_status: 'pending',
  wikidata_candidates: null,
  wikidata_enriched_at: null,
  narrative_status: 'pending',
  added_at: '2026-04-04T00:00:00Z',
  franchise: null,
  wikidata_sitelinks: null,
  fame_tier: 0,
  fame_rated_at: null,
  fame_rated_by: null,
  fame_score: null,
  fame_score_version: null,
  search_text: 'test hero',
  enwiki_title: null,
  pageviews_week: null,
  pageviews_prev: null,
  pageviews_spike: null,
  pageviews_at: null,
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

// ─── heroRowToCharacterData — v2 comicvine fields ────────────────────────────

describe('heroRowToCharacterData — v2 comicvine fields', () => {
  it('maps description to details.description', () => {
    const hero: HeroRow = { ...baseHero, description: 'A bitten spider gave him powers.' };
    const result = heroRowToCharacterData(hero);
    expect(result.details.description).toBe('A bitten spider gave him powers.');
  });

  it('maps null description to null', () => {
    const result = heroRowToCharacterData({ ...baseHero, description: null });
    expect(result.details.description).toBeNull();
  });

  it('maps origin to details.origin', () => {
    const hero: HeroRow = { ...baseHero, origin: 'Mutant' };
    const result = heroRowToCharacterData(hero);
    expect(result.details.origin).toBe('Mutant');
  });

  it('maps issue_count to details.issueCount', () => {
    const hero: HeroRow = { ...baseHero, issue_count: 4891 };
    const result = heroRowToCharacterData(hero);
    expect(result.details.issueCount).toBe(4891);
  });

  it('maps creators array to details.creators', () => {
    const hero: HeroRow = { ...baseHero, creators: ['Stan Lee', 'Steve Ditko'] };
    const result = heroRowToCharacterData(hero);
    expect(result.details.creators).toEqual(['Stan Lee', 'Steve Ditko']);
  });

  it('maps enemies array to details.enemies', () => {
    const hero: HeroRow = { ...baseHero, enemies: ['Green Goblin', 'Venom'] };
    const result = heroRowToCharacterData(hero);
    expect(result.details.enemies).toEqual(['Green Goblin', 'Venom']);
  });

  it('maps friends array to details.friends', () => {
    const hero: HeroRow = { ...baseHero, friends: ['Iron Man', 'Captain America'] };
    const result = heroRowToCharacterData(hero);
    expect(result.details.friends).toEqual(['Iron Man', 'Captain America']);
  });

  it('maps movies array to details.movies', () => {
    const hero: HeroRow = { ...baseHero, movies: ['Spider-Man: No Way Home (2021)'] };
    const result = heroRowToCharacterData(hero);
    expect(result.details.movies).toEqual(['Spider-Man: No Way Home (2021)']);
  });

  it('maps teams array to details.teams', () => {
    const hero: HeroRow = { ...baseHero, teams: ['Avengers', 'S.H.I.E.L.D.'] };
    const result = heroRowToCharacterData(hero);
    expect(result.details.teams).toEqual(['Avengers', 'S.H.I.E.L.D.']);
  });

  it('maps all null v2 fields to null', () => {
    const result = heroRowToCharacterData(baseHero);
    expect(result.details.description).toBeNull();
    expect(result.details.origin).toBeNull();
    expect(result.details.issueCount).toBeNull();
    expect(result.details.creators).toBeNull();
    expect(result.details.enemies).toBeNull();
    expect(result.details.friends).toBeNull();
    expect(result.details.movies).toBeNull();
    expect(result.details.teams).toBeNull();
  });
});

// ─── getSearchIdleHeroes ──────────────────────────────────────────────────────

describe('getSearchIdleHeroes', () => {
  it('returns up to 30 heroes', async () => {
    const fakeHeroes = Array.from({ length: 30 }, (_, i) => ({
      id: String(i + 1),
      name: `Hero ${i + 1}`,
      publisher: 'Marvel Comics',
      image_md_url: null,
      image_url: null,
      portrait_url: null,
      full_name: null,
      aliases: [],
    }));
    mockResolveWith = { data: fakeHeroes, error: null };
    const heroes = await getSearchIdleHeroes();
    expect(heroes.length).toBeGreaterThan(0);
    expect(heroes.length).toBeLessThanOrEqual(30);
  });

  it('returns HeroSearchResult shape (has portrait_url, full_name, aliases)', async () => {
    mockResolveWith = {
      data: [
        {
          id: '620',
          name: 'Spider-Man',
          publisher: 'Marvel Comics',
          image_md_url: null,
          image_url: null,
          portrait_url: null,
          full_name: 'Peter Parker',
          aliases: [],
        },
      ],
      error: null,
    };
    const heroes = await getSearchIdleHeroes();
    expect(heroes[0]).toHaveProperty('id');
    expect(heroes[0]).toHaveProperty('name');
    expect(heroes[0]).toHaveProperty('portrait_url');
  });

  it('throws on Supabase error', async () => {
    mockResolveWith = { data: null, error: { message: 'db error' } };
    await expect(getSearchIdleHeroes()).rejects.toThrow('db error');
  });
});

// ─── searchHeroes ordering ────────────────────────────────────────────────────

describe('searchHeroes ordering', () => {
  it('returns spider-man before spider-woman when searching spider', async () => {
    const spiderMan = {
      id: '620',
      name: 'Spider-Man',
      publisher: 'Marvel Comics',
      image_md_url: 'https://cdn.example.com/620-md.jpg',
      image_url: 'https://cdn.example.com/620.jpg',
      portrait_url: null,
      full_name: 'Peter Parker',
      aliases: ['Spidey', 'Web-Slinger'],
      issue_count: 5000,
    };
    const spiderWoman = {
      id: '621',
      name: 'Spider-Woman',
      publisher: 'Marvel Comics',
      image_md_url: 'https://cdn.example.com/621-md.jpg',
      image_url: 'https://cdn.example.com/621.jpg',
      portrait_url: null,
      full_name: 'Jessica Drew',
      aliases: ['Spider-Woman'],
      issue_count: 1000,
    };
    // DB returns pre-ordered by issue_count DESC (Spider-Man first)
    mockResolveWith = { data: [spiderMan, spiderWoman], error: null };

    const results = await searchHeroes('spider', 'All', 20);
    const names = results.map((h) => h.name.toLowerCase());
    const spiderManIdx = names.findIndex((n) => n === 'spider-man');
    const spiderWomanIdx = names.findIndex((n) => n === 'spider-woman');
    expect(spiderManIdx).not.toBe(-1);
    expect(spiderWomanIdx).not.toBe(-1);
    expect(spiderManIdx).toBeLessThan(spiderWomanIdx);
  });
});

describe('getHeroesByPowerRange', () => {
  it('returns an array (even empty) without throwing', async () => {
    const result = await getHeroesByPowerRange(200, 350, '70');
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── getTopHeroByStat ─────────────────────────────────────────────────────────

describe('getTopHeroByStat', () => {
  it('returns the hero data with the highest value for the given stat', async () => {
    const hulk = { id: 332, name: 'Hulk', strength: 100, intelligence: 60, speed: 53 };
    mockResolveWith = { data: hulk, error: null };

    const result = await getTopHeroByStat('strength');

    expect(result).toEqual(hulk);
    expect(mockFrom).toHaveBeenCalledWith('heroes');
    expect(chain.not).toHaveBeenCalledWith('strength', 'is', null);
    expect(chain.order).toHaveBeenCalledWith('strength', { ascending: false });
    expect(chain.limit).toHaveBeenCalledWith(1);
  });

  it('passes the correct stat field to the query chain', async () => {
    mockResolveWith = {
      data: { id: 297, name: 'Brainiac', strength: 28, intelligence: 100, speed: 42 },
      error: null,
    };

    await getTopHeroByStat('intelligence');

    expect(chain.not).toHaveBeenCalledWith('intelligence', 'is', null);
    expect(chain.order).toHaveBeenCalledWith('intelligence', { ascending: false });
  });

  it('returns null when the query errors', async () => {
    mockResolveWith = { data: null, error: { message: 'DB error' } };

    const result = await getTopHeroByStat('speed');

    expect(result).toBeNull();
  });
});

// ─── getPublisherCounts ───────────────────────────────────────────────────────

describe('getPublisherCounts', () => {
  it('returns zeroed counts when all queries return null count', async () => {
    mockResolveWith = { data: null, error: null, count: null };

    const result = await getPublisherCounts();

    expect(result).toEqual<PublisherCounts>({ marvel: 0, dc: 0, other: 0 });
  });

  it('returns counts with correct shape', async () => {
    mockResolveWith = { data: null, error: null, count: 0 };

    const result = await getPublisherCounts();

    expect(result).toHaveProperty('marvel');
    expect(result).toHaveProperty('dc');
    expect(result).toHaveProperty('other');
    expect(typeof result.marvel).toBe('number');
    expect(typeof result.dc).toBe('number');
    expect(typeof result.other).toBe('number');
  });
});

// ─── getFirstAppearanceCovers ─────────────────────────────────────────────────

describe('getFirstAppearanceCovers', () => {
  it('returns covers, filtering out placeholders and non-http urls', async () => {
    mockResolveWith = {
      data: [
        {
          id: '69',
          name: 'Batman',
          first_appearance: 'Detective Comics #27',
          first_issue_image_url: 'https://x/dc27.jpg',
        },
        {
          id: '1',
          name: 'Blank',
          first_appearance: null,
          first_issue_image_url: 'https://x/blank.png',
        },
        { id: '2', name: 'NoHttp', first_appearance: null, first_issue_image_url: '/relative.jpg' },
      ],
      error: null,
    };

    const result = await getFirstAppearanceCovers(10);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Batman');
    expect(chain.not).toHaveBeenCalledWith('first_issue_image_url', 'is', null);
  });

  it('returns [] on error', async () => {
    mockResolveWith = { data: null, error: { message: 'boom' } };
    const result = await getFirstAppearanceCovers();
    expect(result).toEqual([]);
  });
});
