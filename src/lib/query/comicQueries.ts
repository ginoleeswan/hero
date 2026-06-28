// src/lib/query/comicQueries.ts
// React Query hooks for the issue (comic) detail screen — cached/deduped reads,
// replacing the screen's bespoke useEffect/useState fetches.
import { useQuery } from '@tanstack/react-query';
import { getIssueById, getNewComics } from '../db/comics';
import { queryKeys } from './keys';

/** A single issue by id. null = not found. */
export function useIssue(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.issue(id) : ['comics', 'issue', 'disabled'],
    enabled: !!id,
    queryFn: () => getIssueById(id!),
  });
}

/** The latest issues (for the "more new comics" rail). Refreshed infrequently. */
export function useNewComics(limit: number) {
  return useQuery({
    queryKey: queryKeys.newComics(limit),
    queryFn: () => getNewComics(limit),
    staleTime: 1000 * 60 * 30,
  });
}
