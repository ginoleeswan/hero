import { useCallback, useState } from 'react';

const STORAGE_KEY = 'mythique_search_history';
const MAX_HISTORY = 10;
const MIN_QUERY_LENGTH = 3;

function readHistory(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function useSearchHistory() {
  const [history, setHistory] = useState<string[]>(readHistory);

  const addSearch = useCallback((query: string) => {
    if (typeof window === 'undefined') return;
    if (query.trim().length < MIN_QUERY_LENGTH) return;

    setHistory((prev) => {
      const filtered = prev.filter((q) => q !== query);
      const updated = [query, ...filtered].slice(0, MAX_HISTORY);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Silent fail on storage errors
      }
      return updated;
    });
  }, []);

  const clearHistory = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Silent fail on storage errors
      }
    }
    setHistory([]);
  }, []);

  return { history, addSearch, clearHistory };
}
