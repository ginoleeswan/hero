import { useRouter } from 'expo-router';
import { useSearch } from '../../../contexts/SearchContext';
import { useSearchHistory } from '../../../hooks/useSearchHistory';
import { useSearchSuggestions } from '../../../hooks/useSearchSuggestions';
import { useIdleHeroes } from '../../../hooks/useIdleHeroes';
import { IdleSuggestions } from './IdleSuggestions';
import { SuggestionsList } from './SuggestionsList';

export function SearchDropdownContent() {
  const router = useRouter();
  const { query, setQuery, setSearchFocused } = useSearch();
  const { history, addSearch, clearHistory } = useSearchHistory();
  const { suggestions, isLoading, resultCount } = useSearchSuggestions(query);

  const isEmptyQuery = query.trim().length === 0;
  const { heroes: trending, isLoading: trendingLoading } = useIdleHeroes(isEmptyQuery, 4);

  const handleSuggestionPress = (id: string) => {
    addSearch(query);
    router.push(`/character/${id}`);
  };

  const handleHeroPress = (id: string) => {
    router.push(`/character/${id}`);
  };

  const handleSelectRecentSearch = (recentQuery: string) => {
    setQuery(recentQuery);
  };

  const handleViewAll = () => {
    const q = query.trim();
    if (!q) return;
    addSearch(q);
    // Blur the input so the dropdown closes on the /search results page.
    (document.activeElement as HTMLElement)?.blur();
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  if (isEmptyQuery) {
    return (
      <IdleSuggestions
        trending={trending}
        trendingLoading={trendingLoading}
        history={history}
        onHeroPress={handleHeroPress}
        onSelectRecent={handleSelectRecentSearch}
        onClearHistory={clearHistory}
      />
    );
  }

  return (
    <SuggestionsList
      query={query}
      suggestions={suggestions}
      isLoading={isLoading}
      resultCount={resultCount}
      onSuggestionPress={handleSuggestionPress}
      onViewAll={handleViewAll}
    />
  );
}
