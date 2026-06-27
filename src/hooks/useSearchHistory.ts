import { useCallback, useMemo, useState } from 'react';

const STORAGE_KEY = 'mythique_search_history';
const MAX_HISTORY = 10;
const MIN_QUERY_LENGTH = 3;

/**
 * Tidy recent searches for display: drop blanks/fragments and any term that's
 * merely a prefix of a more specific one (so the mid-typing trail
 * "sim → simb → simba" collapses to just "simba"). Case-insensitive de-dupe,
 * newest-first order preserved, capped for a calm list.
 */
export function tidySearchHistory(history: string[]): string[] {
  const seen = new Set<string>();
  const uniq: string[] = [];
  for (const raw of history) {
    const q = raw.trim();
    if (q.length < MIN_QUERY_LENGTH) continue;
    const l = q.toLowerCase();
    if (seen.has(l)) continue;
    seen.add(l);
    uniq.push(q);
  }
  return uniq
    .filter((q) => !uniq.some((o) => o !== q && o.toLowerCase().startsWith(q.toLowerCase())))
    .slice(0, 8);
}

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
      // Persist a prefix-collapsed list so the mid-typing trail never accretes:
      // adding "simba" drops a stored "sim"/"simb" instead of stacking on top.
      const updated = tidySearchHistory([query, ...prev]).slice(0, MAX_HISTORY);
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

  // Always hand back a tidied view so legacy polluted storage (fragments saved
  // before this collapse logic existed) is cleaned on render too.
  const tidied = useMemo(() => tidySearchHistory(history), [history]);

  return { history: tidied, addSearch, clearHistory };
}
