// src/hooks/useMatchupTakes.ts — pick-a-side one-liner debate for a matchup
// pair. React Query owns the take list (cache key = the sorted hero pair so
// A-vs-B and B-vs-A share one cache entry); "agree" is a fire-and-forget RPC
// with an optimistic setQueryData bump so a tap feels instant. agreedIds is
// component-state only (a session affordance, not a persisted source of
// truth — the server enforces the real per-voter toggle).
import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { queryKeys } from '../lib/query/keys';
import { getTakes, postTake, deleteTake, toggleAgree, type Take } from '../lib/db/takes';
import { getVoterKey } from '../lib/voterKey';

export interface UseMatchupTakesResult {
  takes: Take[];
  loading: boolean;
  myTake: Take | null;
  submit: (pickedId: string, body: string) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
  agree: (id: string) => void;
  agreedIds: Set<string>;
  /** Last write failure, human-readable; cleared when the next write starts. */
  error: string | null;
}

function bumpAgreeCount(takes: Take[], id: string, delta: number): Take[] {
  return takes.map((t) => (t.id === id ? { ...t, agreeCount: t.agreeCount + delta } : t));
}

export function useMatchupTakes(heroAId: string, heroBId: string): UseMatchupTakesResult {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [agreedIds, setAgreedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const key = queryKeys.takes(heroAId, heroBId);
  const query = useQuery({
    queryKey: key,
    queryFn: () => getTakes(heroAId, heroBId),
  });

  const takes = query.data ?? [];
  const myTake = takes.find((t) => t.userId === user?.id) ?? null;

  const submit = useCallback(
    async (pickedId: string, body: string): Promise<boolean> => {
      if (!user) return false;
      setError(null);
      const posted = await postTake(heroAId, heroBId, pickedId, body);
      if (!posted) {
        // postTake warns + nulls on any RPC error; the 20-takes/day server
        // rate limit is the most reachable cause, so keep the message generic.
        setError("Couldn't post your take — try again in a bit.");
        return false;
      }
      await queryClient.invalidateQueries({ queryKey: key });
      return true;
    },
    [user, heroAId, heroBId, queryClient, key],
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      setError(null);
      const ok = await deleteTake(id);
      if (!ok) {
        setError("Couldn't delete your take — try again.");
        return false;
      }
      await queryClient.invalidateQueries({ queryKey: key });
      return true;
    },
    [queryClient, key],
  );

  const agree = useCallback(
    (id: string) => {
      const wasAgreed = agreedIds.has(id);
      const delta = wasAgreed ? -1 : 1;
      setError(null);

      // Optimistic: flip local membership + bump the cached count.
      setAgreedIds((prev) => {
        const next = new Set(prev);
        if (wasAgreed) next.delete(id);
        else next.add(id);
        return next;
      });
      queryClient.setQueryData<Take[]>(key, (old) => bumpAgreeCount(old ?? [], id, delta));

      // Roll back on failure — the server didn't record the toggle.
      const rollBack = () => {
        setAgreedIds((prev) => {
          const next = new Set(prev);
          if (wasAgreed) next.add(id);
          else next.delete(id);
          return next;
        });
        queryClient.setQueryData<Take[]>(key, (old) => bumpAgreeCount(old ?? [], id, -delta));
        setError("Couldn't save your agreement — try again.");
      };

      getVoterKey()
        .then((vk) => toggleAgree(id, vk))
        .then((result) => {
          if (!result) rollBack();
        })
        .catch(rollBack);
    },
    [agreedIds, queryClient, key],
  );

  return { takes, loading: query.isLoading, myTake, submit, remove, agree, agreedIds, error };
}
