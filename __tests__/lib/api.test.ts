import {
  fetchHeroDetails,
  fetchFirstIssue,
  generateVerdict,
  fetchHeroGallery,
} from '../../src/lib/api';

const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockInvoke = jest.fn();
jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
  },
}));

jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        comicvineApiKey: 'test-comicvine-key',
      },
    },
  },
}));

beforeEach(() => {
  mockFetch.mockReset();
  mockInvoke.mockReset();
});

describe('fetchHeroDetails', () => {
  it('returns parsed details', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        summary: 'A radioactive spider bite',
        publisher: 'Marvel Comics',
        firstIssueId: '101',
        firstIssueData: null,
        powers: null,
        description: null,
        origin: null,
        issueCount: null,
        creators: null,
        enemies: null,
        friends: null,
        movies: null,
        movieCount: null,
        teams: null,
      },
      error: null,
    });

    const result = await fetchHeroDetails('620', 'Spider-Man');
    expect(result.summary).toBe('A radioactive spider bite');
    expect(result.publisher).toBe('Marvel Comics');
    expect(result.firstIssueId).toBe('101');
  });

  it('returns nulls when edge function returns error', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: new Error('not found') });

    const result = await fetchHeroDetails('999', 'Unknown');
    expect(result.summary).toBeNull();
    expect(result.publisher).toBeNull();
    expect(result.firstIssueId).toBeNull();
    expect(result.powers).toBeNull();
  });

  it('returns powers array from edge function', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        summary: 'A hero of great power.',
        publisher: 'Marvel',
        firstIssueId: null,
        firstIssueData: null,
        powers: ['Flight', 'Super Strength', 'Telepathy'],
        description: null,
        origin: null,
        issueCount: null,
        creators: null,
        enemies: null,
        friends: null,
        movies: null,
        movieCount: null,
        teams: null,
      },
      error: null,
    });

    const result = await fetchHeroDetails('620', 'Spider-Man');
    expect(result.powers).toEqual(['Flight', 'Super Strength', 'Telepathy']);
  });

  it('returns null powers when edge function returns null powers', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        summary: null,
        publisher: null,
        firstIssueId: null,
        firstIssueData: null,
        powers: null,
        description: null,
        origin: null,
        issueCount: null,
        creators: null,
        enemies: null,
        friends: null,
        movies: null,
        movieCount: null,
        teams: null,
      },
      error: null,
    });

    const result = await fetchHeroDetails('999', 'Unknown Hero');
    expect(result.powers).toBeNull();
  });

  it('returns null powers when edge function errors', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: new Error('fail') });

    const result = await fetchHeroDetails('999', 'Nobody');
    expect(result.powers).toBeNull();
  });

  it('passes heroId and heroName to the edge function', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: new Error('ok') });

    await fetchHeroDetails('999', 'Test Hero');
    expect(mockInvoke).toHaveBeenCalledWith('get-comicvine-hero', {
      body: { heroId: '999', heroName: 'Test Hero' },
    });
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

describe('generateVerdict', () => {
  it('returns AI verdict on success', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { verdict: 'Batman dominates.' }, error: null });

    const result = await generateVerdict({
      heroA: 'Batman',
      heroB: 'Spider-Man',
      winsA: 4,
      winsB: 2,
      statsA: { intelligence: 81, strength: 26, speed: 27, durability: 64, power: 47, combat: 64 },
      statsB: { intelligence: 75, strength: 55, speed: 23, durability: 42, power: 36, combat: 42 },
    });
    expect(result).toBe('Batman dominates.');
  });

  it('returns fallback verdict when invoke fails', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('network error'));

    const result = await generateVerdict({
      heroA: 'Batman',
      heroB: 'Spider-Man',
      winsA: 4,
      winsB: 2,
      statsA: { intelligence: 81, strength: 26, speed: 27, durability: 64, power: 47, combat: 64 },
      statsB: { intelligence: 75, strength: 55, speed: 23, durability: 42, power: 36, combat: 42 },
    });
    expect(result).toContain('Batman');
    expect(result).toContain('4');
  });

  it('returns tie fallback when winsA equals winsB', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('network error'));
    const result = await generateVerdict({
      heroA: 'Batman',
      heroB: 'Spider-Man',
      winsA: 3,
      winsB: 3,
      statsA: { intelligence: 81, strength: 26, speed: 27, durability: 64, power: 47, combat: 64 },
      statsB: { intelligence: 75, strength: 55, speed: 23, durability: 42, power: 36, combat: 42 },
    });
    expect(result).toContain('Batman');
    expect(result).toContain('Spider-Man');
    expect(result).toContain('3');
  });
});

describe('fetchHeroGallery', () => {
  // fetchHeroGallery is now a fire-and-refetch trigger: it invokes the edge
  // function and resolves to void. Gallery images are read separately from the
  // hero_images table via getHeroImages.
  it('invokes the gallery edge function with the hero + comicvine ids', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { ok: true }, error: null });

    const result = await fetchHeroGallery('620', '4005-1977');
    expect(result).toBeUndefined();
    expect(mockInvoke).toHaveBeenCalledWith('get-hero-gallery', {
      body: { heroId: '620', comicvineId: '4005-1977' },
    });
  });

  it('resolves without throwing when the edge function errors', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: { message: 'edge error' } });
    await expect(fetchHeroGallery('620', '4005-1977')).resolves.toBeUndefined();
  });
});
