import { useHeroSearch } from './useHeroSearch';

// Palette suggestions = the shared search primitive, capped at the top 8.
export function useSearchSuggestions(query: string) {
  const { results, loading } = useHeroSearch(query, 'All', 100, 300);
  return {
    suggestions: results.slice(0, 8),
    isLoading: loading,
    resultCount: results.length,
  };
}
