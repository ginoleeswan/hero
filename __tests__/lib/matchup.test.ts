import { getTodaysMatchupFromPool } from '../../src/lib/matchup';
import type { Hero } from '../../src/lib/db/heroes';

const mockGetDailyDebate = jest.fn();
const mockGetHeroById = jest.fn();
const mockGetCachedVerdict = jest.fn();
const mockGenerateVerdict = jest.fn();

jest.mock('../../src/lib/db/dailyDebate', () => ({
  getDailyDebate: (...a: unknown[]) => mockGetDailyDebate(...a),
  todayIso: () => '2026-07-12',
}));
jest.mock('../../src/lib/db/heroes', () => ({
  getHeroById: (...a: unknown[]) => mockGetHeroById(...a),
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
//
// It has to mirror it in UTC as well as in arithmetic. Using local date parts
// here made the suite fail every night in any timezone ahead of UTC, for the
// window between local midnight and UTC midnight: the two clocks named
// different days, so the expected seed and the real one differed by one and
// picked different heroes out of the pool.
function dailySeed(d = new Date()): number {
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

const pool: Hero[] = Array.from({ length: 24 }, (_, i) => hero(`p${i}`, `Pool ${i}`));

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCachedVerdict.mockResolvedValue('Cached verdict');
  mockGetHeroById.mockResolvedValue(null);
});

describe('getTodaysMatchupFromPool', () => {
  it('uses the server daily-debate pair when both heroes are already in the pool', async () => {
    const a = pool[3];
    const b = pool[9];
    mockGetDailyDebate.mockResolvedValue({ heroAId: a.id, heroBId: b.id, hookText: 'Round 1' });

    const result = await getTodaysMatchupFromPool(pool);

    expect(result?.heroA.id).toBe(a.id);
    expect(result?.heroB.id).toBe(b.id);
    expect(mockGetHeroById).not.toHaveBeenCalled();
  });

  it('fetches full stat rows by id when the debate pair is off-pool, so stats flow through', async () => {
    mockGetDailyDebate.mockResolvedValue({ heroAId: 'off1', heroBId: 'off2', hookText: null });
    const offA = hero('off1', 'Off One', {
      intelligence: 90,
      strength: 80,
      speed: 70,
      durability: 60,
      power: 95,
      combat: 85,
    });
    const offB = hero('off2', 'Off Two', {
      intelligence: 40,
      strength: 30,
      speed: 20,
      durability: 90,
      power: 35,
      combat: 25,
    });
    mockGetHeroById.mockImplementation((id: string) =>
      Promise.resolve(id === 'off1' ? offA : id === 'off2' ? offB : null),
    );
    mockGetCachedVerdict.mockResolvedValue(null);
    mockGenerateVerdict.mockResolvedValue('Generated verdict');

    const result = await getTodaysMatchupFromPool(pool);

    expect(mockGetHeroById).toHaveBeenCalledWith('off1');
    expect(mockGetHeroById).toHaveBeenCalledWith('off2');
    expect(result?.heroA.id).toBe('off1');
    expect(result?.heroB.id).toBe('off2');
    // Real stats, not zeroed lean rows: A wins 5 of 6, B wins durability only.
    expect(result?.winsA).toBe(5);
    expect(result?.winsB).toBe(1);
    expect(result?.heroA.intelligence).toBe(90);
    expect(result?.heroB.strength).toBe(30);
    expect(mockGenerateVerdict).toHaveBeenCalledWith(
      expect.objectContaining({
        statsA: expect.objectContaining({ intelligence: 90, power: 95 }),
        statsB: expect.objectContaining({ durability: 90, combat: 25 }),
      }),
    );
  });

  it('resolves a partial hit — one hero from the pool, the other fetched by id with stats', async () => {
    const inPool = pool[5];
    mockGetDailyDebate.mockResolvedValue({
      heroAId: inPool.id,
      heroBId: 'off9',
      hookText: null,
    });
    const offB = hero('off9', 'Off Nine', { strength: 99 });
    mockGetHeroById.mockImplementation((id: string) =>
      Promise.resolve(id === 'off9' ? offB : null),
    );

    const result = await getTodaysMatchupFromPool(pool);

    expect(mockGetHeroById).toHaveBeenCalledTimes(1);
    expect(mockGetHeroById).toHaveBeenCalledWith('off9');
    expect(result?.heroA.id).toBe(inPool.id);
    expect(result?.heroB.id).toBe('off9');
    expect(result?.heroB.strength).toBe(99);
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
    mockGetHeroById.mockResolvedValue(null); // both heroes gone (e.g. deleted)

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
