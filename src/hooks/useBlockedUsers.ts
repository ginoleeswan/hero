// src/hooks/useBlockedUsers.ts — shared state behind the Settings "Blocked
// people" section. One hook so app/settings.tsx and app/settings.web.tsx
// (a native/web pair that must not drift) both fetch and unblock the same
// way instead of each re-implementing the list.
import { useCallback, useEffect, useState } from 'react';
import { getBlockedUsers, unblockUser, type BlockedUser } from '../lib/db/blocks';

export interface UseBlockedUsersResult {
  /** True while the initial list is loading. */
  loading: boolean;
  blocked: BlockedUser[];
  /** userId currently being unblocked, or null. Drives a per-row busy state. */
  unblockingId: string | null;
  refetch: () => Promise<void>;
  /** Optimistic: removes the row immediately, re-adds it if the delete fails. */
  unblock: (userId: string) => Promise<boolean>;
}

/**
 * `enabled` gates the fetch — pass the signed-in check (e.g. `!!user`).
 * There is no block list without an account, and the settings screens render
 * for signed-out visitors too, so this hook has to be callable unconditionally
 * (React's rules of hooks) while doing nothing until there's someone to fetch
 * for. Mirrors the `userId | undefined` skip-fetch shape `useProfile` uses.
 */
export function useBlockedUsers(enabled: boolean): UseBlockedUsersResult {
  const [loading, setLoading] = useState(enabled);
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!enabled) return;
    // `loading` initialises from `enabled`, which is false on the first
    // native render (useAuth().user resolves async). Once auth resolves and
    // this runs, loading is still false from that first render, so without
    // this the empty state ("You haven't blocked anyone.") flashes before
    // the request lands. Setting it explicitly here covers both the initial
    // load and any later manual refetch.
    setLoading(true);
    const rows = await getBlockedUsers();
    setBlocked(rows);
    setLoading(false);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    // Initial load has no render-time equivalent — the list doesn't exist
    // until the request returns.
    void refetch();
  }, [enabled, refetch]);

  const unblock = useCallback(
    async (userId: string) => {
      setUnblockingId(userId);
      // Captured from the render-time closure, not read back out of the
      // functional updater below — that updater's callback isn't guaranteed
      // to run before the `await` on the next line resumes, so relying on it
      // to hand back the removed row raced and lost it under test.
      const removed = blocked.find((r) => r.userId === userId);
      setBlocked((rows) => rows.filter((r) => r.userId !== userId));
      const ok = await unblockUser(userId);
      if (!ok && removed) {
        // Restore in its original sort position (createdAt desc, same as the fetch).
        setBlocked((rows) =>
          [...rows, removed].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
        );
      }
      setUnblockingId(null);
      return ok;
    },
    [blocked],
  );

  return { loading, blocked, unblockingId, refetch, unblock };
}
