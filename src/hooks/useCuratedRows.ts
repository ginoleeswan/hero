import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getRelatedHeroes } from '../lib/db/heroes';
import type { RelatedHeroCard } from '../lib/db/heroes/types';

const STALE = 1000 * 60 * 30;

/** Contextual discovery rows for the guided duel, keyed on a side's lead hero:
 *  the lead's canon teammates (Act 1) and arch-enemies / rivals (Act 2). Each
 *  list excludes heroes already placed on either side and degrades to []. */
export function useCuratedRows(
  leadId: string | undefined,
  isPlaced: (id: string) => boolean,
): { teammates: RelatedHeroCard[]; rivals: RelatedHeroCard[] } {
  const teammatesQ = useQuery({
    queryKey: ['curatedRow', 'teammate', leadId ?? ''],
    enabled: !!leadId,
    staleTime: STALE,
    queryFn: () => getRelatedHeroes(leadId as string, 'teammate', { limit: 20 }),
  });
  const rivalsQ = useQuery({
    queryKey: ['curatedRow', 'enemy', leadId ?? ''],
    enabled: !!leadId,
    staleTime: STALE,
    queryFn: () => getRelatedHeroes(leadId as string, 'enemy', { limit: 20 }),
  });

  const teammates = useMemo(
    () => (teammatesQ.data ?? []).filter((h) => !isPlaced(h.id)),
    [teammatesQ.data, isPlaced],
  );
  const rivals = useMemo(
    () => (rivalsQ.data ?? []).filter((h) => !isPlaced(h.id)),
    [rivalsQ.data, isPlaced],
  );

  return { teammates, rivals };
}
