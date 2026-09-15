// Cursor-paged activity history for the command center. Backs both the
// overview's "Live activity" panel (first page polled as the live tick, more
// pages on demand) and Audience › Activity (the full scrollable history with a
// kind filter). One hook, so both surfaces share a cache per filter.
import { useInfiniteQuery } from '@tanstack/react-query';
import {
  fetchActivityFeed,
  type ActivityEvent,
  type ActivityFilter,
  type ActivityPage,
} from '../lib/db/activityFeed';

export const ACTIVITY_PAGE = 40;

export function useActivityHistory({
  kind = 'all',
  enabled = true,
  live = false,
  pageSize = ACTIVITY_PAGE,
}: {
  kind?: ActivityFilter;
  enabled?: boolean;
  /** Poll the first page every 20s (the overview's "now" tick). */
  live?: boolean;
  pageSize?: number;
}) {
  const q = useInfiniteQuery<ActivityPage | null, Error>({
    queryKey: ['activityHistory', kind, pageSize],
    queryFn: ({ pageParam }) =>
      fetchActivityFeed({ before: (pageParam as string | null) ?? null, limit: pageSize, kind }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last?.nextBefore ?? undefined,
    enabled,
    staleTime: 15_000,
    refetchInterval: live ? 20_000 : false,
    // A poll refetches every loaded page; once someone has paged deep that gets
    // expensive, so keep only the newest three pages hot during a live tick.
    maxPages: live ? 3 : undefined,
  });

  const pages = q.data?.pages ?? [];
  // `null` from the first page means "not deployed / not admin" — the caller
  // decides what to fall back to.
  const unavailable = pages.length > 0 && pages[0] === null;
  const items: ActivityEvent[] = pages.flatMap((p) => p?.items ?? []);

  return {
    items,
    unavailable,
    loading: q.isLoading,
    loadingMore: q.isFetchingNextPage,
    hasMore: Boolean(q.hasNextPage),
    loadMore: () => {
      if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
    },
    refetch: q.refetch,
  };
}
