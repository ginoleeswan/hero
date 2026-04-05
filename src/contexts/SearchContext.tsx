import { createContext, useContext, useState } from 'react';
import type { PublisherFilter } from '../lib/db/heroes';

interface SearchContextValue {
  query: string;
  setQuery: (q: string) => void;
  publisher: PublisherFilter;
  setPublisher: (p: PublisherFilter) => void;
}

const SearchContext = createContext<SearchContextValue>({
  query: '',
  setQuery: () => {},
  publisher: 'All',
  setPublisher: () => {},
});

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState('');
  const [publisher, setPublisher] = useState<PublisherFilter>('All');
  return (
    <SearchContext.Provider value={{ query, setQuery, publisher, setPublisher }}>
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch() {
  return useContext(SearchContext);
}
