import { useEffect } from 'react';
import { recordView } from '../lib/db/viewHistory';

/**
 * Fire-and-forget: records a hero view in user_view_history when the
 * character screen mounts. Safe to call unconditionally — skips if no userId.
 */
export function useRecordView(userId: string | undefined, heroId: string): void {
  useEffect(() => {
    if (!userId || !heroId) return;
    recordView(userId, heroId).catch(() => {});
  }, [userId, heroId]);
}
