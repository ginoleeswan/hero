import { fetchHeroStats, fetchHeroDetails, fetchFirstIssue } from '../../src/lib/api';

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
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/620'),
    );
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
