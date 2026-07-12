import { getTodaysMatchupFromPool } from '../../src/lib/matchup';
import type { Hero } from '../../src/lib/db/heroes';

const mockGetDailyDebate = jest.fn();
const mockGetHeroesByIds = jest.fn();
const mockGetCachedVerdict = jest.fn();
const mockGenerateVerdict = jest.fn();

jest.mock('../../src/lib/db/dailyDebate', () => ({
  getDailyDebate: (...a: unknown[]) => mockGetDailyDebate(...a),
  todayIso: () => '2026-07-12',
}));
jest.mock('../../src/lib/db/heroes', () => ({
  getHeroesByIds: (...a: unknown[]) => mockGetHeroesByIds(...a),
  getIconicHeroes: jest.fn(),
}));
jest.mock('../../src/lib/db/verdicts', () => ({
  getCachedVerdict: (...a: unknown[]) => mockGetCachedVerdict(...a),
}));
jest.mock('../../src/lib/api', () => ({
  generateVerdict: (...a: unknown[]) => mockGenerateVerdict(...a),
}));

const hero = (id: string, name: string, stats: Partial<Hero> = {}): Hero =>
  ({
    id,
    name,
    image_url: null,
    portrait_url: null,
    publisher: null,
    intelligence: 50,
    strength: 50,
    speed: 50,
    durability: 50,
    power: 50,
    combat: 50,
    ...stats,
  }) as unknown as Hero;

// Mirrors matchup.ts's private dailySeed(), so the fallback-path assertions
// stay correct regardless of what "today" happens to be when the suite runs.
function dailySeed(d = new Date()): number {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

const pool: Hero[] = Array.from({ length: 24 }, (_, i) => hero(`p${i}`, `Pool ${i}`));

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCachedVerdict.mockResolvedValue('Cached verdict');
});

describe('getTodaysMatchupFromPool', () => {
  it('uses the server daily-debate pair when both heroes are already in the pool', async () => {
    const a = pool[3];
    const b = pool[9];
    mockGetDailyDebate.mockResolvedValue({ heroAId: a.id, heroBId: b.id, hookText: 'Round 1' });

    const result = await getTodaysMatchupFromPool(pool);

    expect(result?.heroA.id).toBe(a.id);
    expect(result?.heroB.id).toBe(b.id);
    expect(mockGetHeroesByIds).not.toHaveBeenCalled();
  });

  it('fetches by id when the debate pair is not in the pool', async () => {
    mockGetDailyDebate.mockResolvedValue({ heroAId: 'off1', heroBId: 'off2', hookText: null });
    mockGetHeroesByIds.mockResolvedValue([
      { id: 'off1', name: 'Off One', image_url: null, portrait_url: null, publisher: null },
      { id: 'off2', name: 'Off Two', image_url: null, portrait_url: null, publisher: null },
    ]);

    const result = await getTodaysMatchupFromPool(pool);

    expect(mockGetHeroesByIds).toHaveBeenCalledWith(['off1', 'off2']);
    expect(result?.heroA.id).toBe('off1');
    expect(result?.heroB.id).toBe('off2');
  });

  it('falls back to the seeded pool pick, byte-identical to before, when there is no server row', async () => {
    mockGetDailyDebate.mockResolvedValue(null);

    const seed = dailySeed();
    const iA = seed % pool.length;
    let iB = (seed * 7 + 3) % pool.length;
    if (iB === iA) iB = (iB + 1) % pool.length;

    const result = await getTodaysMatchupFromPool(pool);

    expect(result?.heroA.id).toBe(pool[iA].id);
    expect(result?.heroB.id).toBe(pool[iB].id);
  });

  it('falls back to the seeded pick when the debate pair cannot be resolved at all', async () => {
    mockGetDailyDebate.mockResolvedValue({ heroAId: 'ghost1', heroBId: 'ghost2', hookText: null });
    mockGetHeroesByIds.mockResolvedValue([]); // both heroes gone (e.g. deleted)

    const seed = dailySeed();
    const iA = seed % pool.length;
    let iB = (seed * 7 + 3) % pool.length;
    if (iB === iA) iB = (iB + 1) % pool.length;

    const result = await getTodaysMatchupFromPool(pool);

    expect(result?.heroA.id).toBe(pool[iA].id);
    expect(result?.heroB.id).toBe(pool[iB].id);
  });

  it('returns null when the pool has fewer than two heroes and there is no server row', async () => {
    mockGetDailyDebate.mockResolvedValue(null);
    expect(await getTodaysMatchupFromPool([pool[0]])).toBeNull();
  });
});
