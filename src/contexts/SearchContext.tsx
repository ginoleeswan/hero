import { createContext, useContext, useState } from 'react';
import type { PublisherFilter } from '../lib/db/heroes';

interface SearchContextValue {
  query: string;
  setQuery: (q: string) => void;
  publisher: PublisherFilter;
  setPublisher: (p: PublisherFilter) => void;
  searchFocused: boolean;
  setSearchFocused: (f: boolean) => void;
}

const SearchContext = createContext<SearchContextValue>({
  query: '',
  setQuery: () => {},
  publisher: 'All',
  setPublisher: () => {},
  searchFocused: false,
  setSearchFocused: () => {},
});

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState('');
  const [publisher, setPublisher] = useState<PublisherFilter>('All');
  const [searchFocused, setSearchFocused] = useState(false);
  return (
    <SearchContext.Provider
      value={{ query, setQuery, publisher, setPublisher, searchFocused, setSearchFocused }}
    >
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch() {
  return useContext(SearchContext);
}
