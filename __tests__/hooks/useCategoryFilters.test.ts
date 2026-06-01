import { renderHook, act } from '@testing-library/react-native';
import { useCategoryFilters } from '../../src/hooks/useCategoryFilters';
import { DEFAULT_FILTERS } from '../../src/lib/db/categoryFilters';

let mockParams: Record<string, string> = {};
const mockSetParams = jest.fn((p: Record<string, string>) => { mockParams = { ...mockParams, ...p }; });

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ setParams: mockSetParams }),
}));

beforeEach(() => { mockParams = {}; mockSetParams.mockClear(); });

describe('useCategoryFilters', () => {
  it('starts from DEFAULT_FILTERS for a plain slug', () => {
    const { result } = renderHook(() => useCategoryFilters('popular'));
    expect(result.current.filters).toEqual(DEFAULT_FILTERS);
  });

  it('uses the slug default sort (power) for strongest', () => {
    const { result } = renderHook(() => useCategoryFilters('strongest'));
    expect(result.current.filters.sort).toBe('power');
  });

  it('setFilter updates state and pushes to the URL', () => {
    const { result } = renderHook(() => useCategoryFilters('popular'));
    act(() => result.current.setFilter('gender', 'female'));
    expect(result.current.filters.gender).toBe('female');
    expect(mockSetParams).toHaveBeenCalledWith(expect.objectContaining({ gender: 'female' }));
  });

  it('selecting the power sort auto-enables hasStats', () => {
    const { result } = renderHook(() => useCategoryFilters('popular'));
    act(() => result.current.setFilter('sort', 'power'));
    expect(result.current.filters.hasStats).toBe(true);
  });

  it('reset returns to defaults and clears params', () => {
    mockParams = { gender: 'female', alignment: 'bad' };
    const { result } = renderHook(() => useCategoryFilters('popular'));
    act(() => result.current.reset());
    expect(result.current.filters).toEqual(DEFAULT_FILTERS);
    expect(mockSetParams).toHaveBeenCalledWith({ publisher: '', alignment: '', gender: '', stats: '', sort: '', q: '' });
  });
});
