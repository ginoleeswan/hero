// src/lib/query/heroDetailQueries.ts
// React Query hooks for the character detail screen's secondary, read-only data —
// the pieces useHeroDetail used to fetch with bespoke useEffect/useState. Keyed by
// hero id so revisits are served from cache (the core row already goes through
// useHeroRow). These all change rarely, so they hold a long staleTime. The
// ComicVine read-through enrichment and the optimistic favourite toggle stay in
// the hook — they're side-effecting, not plain reads.
import { useQuery } from '@tanstack/react-query';
import { getHeroFamily } from '../db/heroes';
import { getHeroTitles } from '../db/titles';
import { getHeroPortrayals, getHeroLinks } from '../db/people';
import { getIssuesForHero } from '../db/comics';
import { getHeroNarrative } from '../db/heroFacts';
import { getHeroEventMoments } from '../db/events.heroMoments';
import { getProfile } from '../db/profiles';
import { queryKeys } from './keys';

const LONG = 1000 * 60 * 30; // these shift rarely; keep revisits off the network

export function useHeroFamily(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.heroFamily(id) : ['heroes', 'family', 'disabled'],
    enabled: !!id,
    queryFn: () => getHeroFamily(id!),
    staleTime: LONG,
  });
}

/** Editions where this character was among the readership. Frozen history — it
 *  only changes when a new event is caught — so it caches as long as the rest. */
export function useHeroEventMoments(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.heroEventMoments(id) : ['heroes', 'eventMoments', 'disabled'],
    enabled: !!id,
    queryFn: () => getHeroEventMoments(id!),
    staleTime: LONG,
  });
}

export function useHeroNarrative(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.heroNarrative(id) : ['heroes', 'narrative', 'disabled'],
    enabled: !!id,
    queryFn: () => getHeroNarrative(id!),
    staleTime: LONG,
  });
}

export function useHeroTitles(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.heroTitles(id) : ['heroes', 'titles', 'disabled'],
    enabled: !!id,
    queryFn: () => getHeroTitles(id!),
    staleTime: LONG,
  });
}

export function useHeroPortrayals(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.heroPortrayals(id) : ['heroes', 'portrayals', 'disabled'],
    enabled: !!id,
    queryFn: () => getHeroPortrayals(id!),
    staleTime: LONG,
  });
}

export function useHeroLinks(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.heroLinks(id) : ['heroes', 'links', 'disabled'],
    enabled: !!id,
    queryFn: () => getHeroLinks(id!),
    staleTime: LONG,
  });
}

export function useHeroIssues(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.heroIssues(id) : ['heroes', 'issues', 'disabled'],
    enabled: !!id,
    queryFn: () => getIssuesForHero(id!),
    staleTime: LONG,
  });
}

/** Whether the signed-in user is an admin (drives the contribute/edit affordances). */
export function useIsAdmin(userId: string | undefined) {
  return useQuery({
    queryKey: userId ? queryKeys.isAdmin(userId) : ['profile', 'disabled', 'isAdmin'],
    enabled: !!userId,
    queryFn: async () => !!(await getProfile(userId!))?.is_admin,
    staleTime: LONG,
  });
}
