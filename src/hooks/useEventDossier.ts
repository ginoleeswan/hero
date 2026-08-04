// src/hooks/useEventDossier.ts
// Platform-neutral: the native and web event pages share this so neither owns
// the fetching. Per the repo convention for .web/.native view pairs.
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getEventDossier,
  getEventIndex,
  type EventDossier,
  type EventIndex,
} from '../lib/db/events.dossier';

/** Days between two ISO dates, inclusive of both ends. Null when either is
 *  missing or unparseable, so the caller shows nothing rather than "NaN days". */
export function windowLengthDays(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
  return Math.round((b - a) / 86_400_000) + 1;
}

/** "23–26 July 2026", or "23 July 2026" for a single day. */
export function formatWindow(from: string | null, to: string | null): string | null {
  if (!from) return null;
  const a = new Date(`${from}T00:00:00Z`);
  if (Number.isNaN(a.getTime())) return null;
  const month = a.toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' });
  const year = a.getUTCFullYear();
  if (!to || to === from) return `${a.getUTCDate()} ${month} ${year}`;
  const b = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(b.getTime())) return `${a.getUTCDate()} ${month} ${year}`;
  const bMonth = b.toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' });
  if (bMonth === month && b.getUTCFullYear() === year) {
    return `${a.getUTCDate()}–${b.getUTCDate()} ${month} ${year}`;
  }
  return `${a.getUTCDate()} ${month} – ${b.getUTCDate()} ${bMonth} ${year}`;
}

export interface UseEventDossier {
  dossier: EventDossier | null;
  loading: boolean;
  /** Resolved and definitely absent — an unknown, disabled or unapproved slug. */
  notFound: boolean;
  /** The fetch failed. Distinct from `notFound`: the event may well exist. */
  failed: boolean;
  /** Re-run the fetch. Paired with `failed`. */
  retry: () => void;
  windowLabel: string | null;
  windowDays: number | null;
}

export function useEventDossier(slug: string | undefined): UseEventDossier {
  const { data, isLoading, isError, isSuccess, refetch } = useQuery({
    queryKey: ['event-dossier', slug],
    queryFn: () => getEventDossier(slug as string),
    enabled: !!slug,
    // An event page is history the moment the window closes; it does not need
    // to be refetched aggressively.
    staleTime: 5 * 60_000,
  });

  return useMemo(() => {
    const dossier = data ?? null;
    return {
      dossier,
      loading: isLoading,
      // Gated on isSuccess, not merely "finished with nothing". Before
      // getEventDossier threw, a failed fetch also produced an empty result, so
      // this was true for outages too and the screen's error branch could never
      // render — every failure claimed the event had no page.
      notFound: isSuccess && !!slug && !dossier,
      failed: isError,
      retry: () => void refetch(),
      windowLabel: dossier ? formatWindow(dossier.event.liveFrom, dossier.event.liveTo) : null,
      windowDays: dossier ? windowLengthDays(dossier.event.liveFrom, dossier.event.liveTo) : null,
    };
  }, [data, isLoading, isError, isSuccess, refetch, slug]);
}

/** Every event that has a page, newest first. */
export function useEventIndex(): { index: EventIndex | null; loading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ['event-index'],
    queryFn: getEventIndex,
    staleTime: 5 * 60_000,
  });
  return { index: data ?? null, loading: isLoading };
}
