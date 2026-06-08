import { renderHook, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRecentSearches } from '../../src/hooks/useRecentSearches';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('useRecentSearches', () => {
  it('adds terms most-recent-first, dedupes, and ignores too-short queries', async () => {
    const { result } = renderHook(() => useRecentSearches());

    await act(async () => result.current.addRecent('spider'));
    await act(async () => result.current.addRecent('thor'));
    await act(async () => result.current.addRecent('spider')); // dedupe → moves to front
    await act(async () => result.current.addRecent('a')); // below min length → ignored

    expect(result.current.recent).toEqual(['spider', 'thor']);
  });

  it('clears history', async () => {
    const { result } = renderHook(() => useRecentSearches());
    await act(async () => result.current.addRecent('spider'));
    await act(async () => result.current.clearRecent());
    expect(result.current.recent).toEqual([]);
  });
});
