// src/hooks/useEventEditions.ts
// Platform-neutral, per the repo's .web/.native view-pair convention: the hub and
// edition pages exist in both flavours and neither owns the fetching.
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getEventHub, getEventEdition, type EventHub } from '../lib/db/events.editions';
import type { EventDossier } from '../lib/db/events.dossier';
import { formatWindow, windowLengthDays } from './useEventDossier';

interface Resolved<T> {
  data: T | null;
  loading: boolean;
  /** Resolved and definitely absent. Distinct from `failed` on purpose: an
   *  unknown slug is a dead link, an outage is not, and the screens say
   *  different things. */
  notFound: boolean;
  failed: boolean;
  retry: () => void;
}

export interface UseEventHub extends Resolved<EventHub> {
  hub: EventHub | null;
}

export function useEventHub(slug: string | undefined): UseEventHub {
  const { data, isLoading, isError, isSuccess, refetch } = useQuery({
    queryKey: ['event-hub', slug],
    queryFn: () => getEventHub(slug as string),
    enabled: !!slug,
    // The hub changes when an edition is frozen or the live flag flips, neither
    // of which is a per-second concern.
    staleTime: 5 * 60_000,
  });

  return useMemo(() => {
    const hub = data ?? null;
    return {
      data: hub,
      hub,
      loading: isLoading,
      notFound: isSuccess && !!slug && !hub,
      failed: isError,
      retry: () => void refetch(),
    };
  }, [data, isLoading, isError, isSuccess, refetch, slug]);
}

export interface UseEventEdition extends Resolved<EventDossier> {
  dossier: EventDossier | null;
  windowLabel: string | null;
  windowDays: number | null;
}

export function useEventEdition(
  slug: string | undefined,
  edition: string | undefined,
): UseEventEdition {
  const { data, isLoading, isError, isSuccess, refetch } = useQuery({
    queryKey: ['event-edition', slug, edition],
    queryFn: () => getEventEdition(slug as string, edition as string),
    enabled: !!slug && !!edition,
    // A frozen edition is history. It only changes when enrichment improves the
    // recomputed half, which is a matter of days.
    staleTime: 30 * 60_000,
  });

  return useMemo(() => {
    const dossier = data ?? null;
    return {
      data: dossier,
      dossier,
      loading: isLoading,
      notFound: isSuccess && !!slug && !!edition && !dossier,
      failed: isError,
      retry: () => void refetch(),
      windowLabel: dossier ? formatWindow(dossier.event.liveFrom, dossier.event.liveTo) : null,
      windowDays: dossier ? windowLengthDays(dossier.event.liveFrom, dossier.event.liveTo) : null,
    };
  }, [data, isLoading, isError, isSuccess, refetch, slug, edition]);
}
