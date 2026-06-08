// src/hooks/useRecentSearches.ts — native recent-search history (AsyncStorage).
// Web uses useSearchHistory (localStorage); this is the native sibling.
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'mythique_search_history';
const MAX_HISTORY = 8;
const MIN_QUERY_LENGTH = 2;

export function useRecentSearches() {
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setRecent(JSON.parse(raw) as string[]);
      })
      .catch(() => {});
  }, []);

  const addRecent = useCallback((query: string) => {
    const q = query.trim();
    if (q.length < MIN_QUERY_LENGTH) return;
    setRecent((prev) => {
      const next = [q, ...prev.filter((p) => p.toLowerCase() !== q.toLowerCase())].slice(
        0,
        MAX_HISTORY,
      );
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const clearRecent = useCallback(() => {
    setRecent([]);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }, []);

  return { recent, addRecent, clearRecent };
}
