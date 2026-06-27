import { renderHook } from '@testing-library/react-native';
import { useUnifiedSearch } from '../../src/hooks/useUnifiedSearch';
import { useHeroSearch } from '../../src/hooks/useHeroSearch';
import type { HeroSearchResult } from '../../src/lib/db/heroes';

jest.mock('../../src/hooks/useHeroSearch', () => ({ useHeroSearch: jest.fn() }));

const mockUseHeroSearch = useHeroSearch as jest.MockedFunction<typeof useHeroSearch>;

const hero = (id: string): HeroSearchResult =>
  ({
    id,
    name: id,
    publisher: null,
    alignment: null,
    image_md_url: null,
    image_url: null,
    portrait_url: null,
    full_name: null,
    aliases: null,
  }) as HeroSearchResult;

describe('useUnifiedSearch', () => {
  beforeEach(() => jest.clearAllMocks());

  it('merges universe hits with hero results', () => {
    mockUseHeroSearch.mockReturnValue({
      results: [hero('a'), hero('b')],
      loading: false,
      hasCriteria: true,
    });
    const { result } = renderHook(() => useUnifiedSearch('disney'));
    expect(result.current.universes[0].slug).toBe('disney');
    expect(result.current.heroes).toHaveLength(2);
    expect(result.current.resultCount).toBe(2);
  });

  it('still returns universes when hero search is empty', () => {
    mockUseHeroSearch.mockReturnValue({ results: [], loading: false, hasCriteria: true });
    const { result } = renderHook(() => useUnifiedSearch('marvel'));
    expect(result.current.universes.length).toBeGreaterThan(0);
    expect(result.current.heroes).toEqual([]);
  });

  it('returns no universes for an empty query', () => {
    mockUseHeroSearch.mockReturnValue({ results: [], loading: false, hasCriteria: false });
    const { result } = renderHook(() => useUnifiedSearch(''));
    expect(result.current.universes).toEqual([]);
  });
});
