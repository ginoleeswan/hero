import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { recordView } from '../lib/db/viewHistory';
import { viewHistoryKeys } from '../lib/query/keys';

/**
 * Fire-and-forget: records a hero view in user_view_history when the
 * character screen mounts. Safe to call unconditionally — skips if no userId.
 *
 * Invalidates the cached recently-viewed list afterwards so the home rail and
 * the search palette pick the new character up on their next mount instead of
 * serving a stale list for the whole staleTime.
 */
export function useRecordView(userId: string | undefined, heroId: string): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!userId || !heroId) return;
    recordView(userId, heroId)
      .then(() => queryClient.invalidateQueries({ queryKey: viewHistoryKeys.recent(userId) }))
      .catch(() => {});
  }, [userId, heroId, queryClient]);
}
