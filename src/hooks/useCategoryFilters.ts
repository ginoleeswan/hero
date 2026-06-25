import { useCallback, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { CategorySlug } from '../lib/db/heroes';
import {
  type CategoryFilters,
  DEFAULT_FILTERS,
  filtersToParams,
  paramsToFilters,
} from '../lib/db/categoryFilters';

type Single = string | string[] | undefined;
const one = (v: Single): string | undefined => (Array.isArray(v) ? v[0] : v);

export function useCategoryFilters(slug: CategorySlug | null) {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Seed state once from the URL; thereafter state is the source of truth and
  // we push changes back to the URL (matches app/search.web.tsx).
  const [filters, setFilters] = useState<CategoryFilters>(() =>
    paramsToFilters(slug, {
      publisher: one(params.publisher),
      alignment: one(params.alignment),
      gender: one(params.gender),
      stats: one(params.stats),
      sort: one(params.sort),
      q: one(params.q),
    }),
  );

  const pushUrl = useCallback(
    (next: CategoryFilters) => {
      const p = filtersToParams(slug, next);
      // Clear keys that fell back to default by sending empty strings.
      router.setParams({
        publisher: p.publisher ?? '',
        alignment: p.alignment ?? '',
        gender: p.gender ?? '',
        stats: p.stats ?? '',
        sort: p.sort ?? '',
        q: p.q ?? '',
      });
    },
    [router, slug],
  );

  const update = useCallback(
    (next: CategoryFilters) => {
      setFilters(next);
      pushUrl(next);
    },
    [pushUrl],
  );

  const setFilter = useCallback(
    <K extends keyof CategoryFilters>(key: K, value: CategoryFilters[K]) => {
      // Derive `next` from the current filters and apply both setters as plain
      // statements. Calling pushUrl (→ router.setParams) inside a setFilters
      // *updater* runs it during React's render phase, which triggers a
      // navigation update mid-render ("Cannot update a component while
      // rendering a different component").
      let next: CategoryFilters = { ...filters, [key]: value };
      if (key === 'sort' && value === 'power') next = { ...next, hasStats: true };
      setFilters(next);
      pushUrl(next);
    },
    [filters, pushUrl],
  );

  const reset = useCallback(() => {
    update({ ...DEFAULT_FILTERS, sort: paramsToFilters(slug, {}).sort });
  }, [update, slug]);

  return useMemo(() => ({ filters, setFilter, reset }), [filters, setFilter, reset]);
}
