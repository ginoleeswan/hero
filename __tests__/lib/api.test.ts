import { fetchHeroStats, fetchHeroDetails, fetchFirstIssue, generateVerdict } from '../../src/lib/api';

const mockFetch = jest.fn();
global.fetch = mockFetch;

jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        superheroApiKey: 'test-superhero-key',
        comicvineApiKey: 'test-comicvine-key',
      },
    },
  },
}));

beforeEach(() => {
  mockFetch.mockReset();
});

describe('fetchHeroStats', () => {
  it('returns hero data on success', async () => {
    const payload = { response: 'success', id: '620', name: 'Spider-Man' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => payload,
    });

    const result = await fetchHeroStats('620');
    expect(result.name).toBe('Spider-Man');
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/620'));
  });

  it('throws when API returns error response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ response: 'error', error: 'Hero not found' }),
    });

    await expect(fetchHeroStats('999')).rejects.toThrow('Hero not found');
  });

  it('throws on non-ok HTTP status', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(fetchHeroStats('620')).rejects.toThrow('SuperheroAPI error: 500');
  });
});

describe('fetchHeroDetails', () => {
  it('returns parsed details', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            deck: 'A radioactive spider bite',
            publisher: { name: 'Marvel Comics' },
            first_appeared_in_issue: { id: 101 },
          },
        ],
      }),
    });

    const result = await fetchHeroDetails('Spider-Man');
    expect(result.summary).toBe('A radioactive spider bite');
    expect(result.publisher).toBe('Marvel Comics');
    expect(result.firstIssueId).toBe('101');
  });

  it('returns nulls when no results', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] }),
    });

    const result = await fetchHeroDetails('Unknown');
    expect(result).toEqual({ summary: null, publisher: null, firstIssueId: null });
  });
});

describe('fetchFirstIssue', () => {
  it('returns issue with image URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: { id: 101, image: { medium_url: 'https://example.com/cover.jpg' } },
      }),
    });

    const result = await fetchFirstIssue('101');
    expect(result.id).toBe('101');
    expect(result.imageUrl).toBe('https://example.com/cover.jpg');
  });
});

// generateVerdict uses its own fetch mocking — restore after each test
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

describe('generateVerdict', () => {
  it('returns AI verdict on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ verdict: 'Batman dominates.' }),
    } as Response);

    const result = await generateVerdict({
      heroA: 'Batman', heroB: 'Spider-Man',
      winsA: 4, winsB: 2,
      statsA: { intelligence: 81, strength: 26, speed: 27, durability: 64, power: 47, combat: 64 },
      statsB: { intelligence: 75, strength: 55, speed: 23, durability: 42, power: 36, combat: 42 },
    });
    expect(result).toBe('Batman dominates.');
  });

  it('returns fallback verdict when fetch fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network error'));

    const result = await generateVerdict({
      heroA: 'Batman', heroB: 'Spider-Man',
      winsA: 4, winsB: 2,
      statsA: { intelligence: 81, strength: 26, speed: 27, durability: 64, power: 47, combat: 64 },
      statsB: { intelligence: 75, strength: 55, speed: 23, durability: 42, power: 36, combat: 42 },
    });
    expect(result).toContain('Batman');
    expect(result).toContain('4');
  });

  it('returns tie fallback when winsA equals winsB', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network error'));
    const result = await generateVerdict({
      heroA: 'Batman', heroB: 'Spider-Man',
      winsA: 3, winsB: 3,
      statsA: { intelligence: 81, strength: 26, speed: 27, durability: 64, power: 47, combat: 64 },
      statsB: { intelligence: 75, strength: 55, speed: 23, durability: 42, power: 36, combat: 42 },
    });
    expect(result).toContain('Batman');
    expect(result).toContain('Spider-Man');
    expect(result).toContain('3');
  });
});
