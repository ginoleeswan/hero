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
  remove: (id: string) => Promise<void>;
  agree: (id: string) => void;
  agreedIds: Set<string>;
}

function bumpAgreeCount(takes: Take[], id: string, delta: number): Take[] {
  return takes.map((t) => (t.id === id ? { ...t, agreeCount: t.agreeCount + delta } : t));
}

export function useMatchupTakes(heroAId: string, heroBId: string): UseMatchupTakesResult {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [agreedIds, setAgreedIds] = useState<Set<string>>(new Set());

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
      const posted = await postTake(heroAId, heroBId, pickedId, body);
      if (!posted) return false;
      await queryClient.invalidateQueries({ queryKey: key });
      return true;
    },
    [user, heroAId, heroBId, queryClient, key],
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      await deleteTake(id);
      await queryClient.invalidateQueries({ queryKey: key });
    },
    [queryClient, key],
  );

  const agree = useCallback(
    (id: string) => {
      const wasAgreed = agreedIds.has(id);
      const delta = wasAgreed ? -1 : 1;

      // Optimistic: flip local membership + bump the cached count.
      setAgreedIds((prev) => {
        const next = new Set(prev);
        if (wasAgreed) next.delete(id);
        else next.add(id);
        return next;
      });
      queryClient.setQueryData<Take[]>(key, (old) => bumpAgreeCount(old ?? [], id, delta));

      getVoterKey()
        .then((vk) => toggleAgree(id, vk))
        .then((result) => {
          if (result) return;
          // Roll back on failure (null) — the server didn't record the toggle.
          setAgreedIds((prev) => {
            const next = new Set(prev);
            if (wasAgreed) next.add(id);
            else next.delete(id);
            return next;
          });
          queryClient.setQueryData<Take[]>(key, (old) => bumpAgreeCount(old ?? [], id, -delta));
        })
        .catch(() => {
          setAgreedIds((prev) => {
            const next = new Set(prev);
            if (wasAgreed) next.add(id);
            else next.delete(id);
            return next;
          });
          queryClient.setQueryData<Take[]>(key, (old) => bumpAgreeCount(old ?? [], id, -delta));
        });
    },
    [agreedIds, queryClient, key],
  );

  return { takes, loading: query.isLoading, myTake, submit, remove, agree, agreedIds };
}
