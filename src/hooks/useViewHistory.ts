import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { recordView } from '../lib/db/viewHistory';
import { viewHistoryKeys } from '../lib/query/keys';

/**
 * Fire-and-forget: records a hero view when the character screen mounts.
 *
 * Runs for signed-OUT readers too — the local mirror in `recordView` is the
 * whole point (see viewHistory.ts). This used to bail on a missing userId,
 * which is why an anonymous reader's Recently Viewed rail stayed empty no
 * matter how much of the catalogue they went through.
 *
 * Invalidates the cached recently-viewed list afterwards so the home rail and
 * the search landing pick the new character up on their next mount instead of
 * serving a stale list for the whole staleTime.
 */
export function useRecordView(userId: string | undefined, heroId: string): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!heroId) return;
    recordView(userId, heroId)
      .then(() => queryClient.invalidateQueries({ queryKey: viewHistoryKeys.recent(userId ?? '') }))
      .catch(() => {});
  }, [userId, heroId, queryClient]);
}
