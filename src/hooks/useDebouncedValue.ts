// src/hooks/useDebouncedValue.ts — the one debounced-value hook.
//
// Three screens had grown their own byte-identical copy of this (the two
// opponent pickers and the Search tab), which is how the Search tab ended up
// with a subtly different one: it needs an EMPTY query to land immediately,
// because the idle surface (recent searches, category pods) must not sit on
// screen next to the previous query's result sections for a debounce beat.
// That behaviour is the `flushIf` predicate rather than a fourth copy.
//
// Not to be confused with `useUnifiedSearch`'s internal debounced *fetcher* —
// that one owns an async result set, which is a different job.
import { useEffect, useState } from 'react';

export function useDebouncedValue<T>(
  value: T,
  delay: number,
  /** Return true for values that should skip the delay and apply at once. */
  flushIf?: (value: T) => boolean,
): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    if (flushIf?.(value)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDebounced(value);
      return;
    }
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
    // `flushIf` is expected to be a stable module-level or memoised predicate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, delay]);

  return debounced;
}

/** Search's rule: an empty query applies immediately. */
export const flushWhenBlank = (v: string) => !v.trim();
