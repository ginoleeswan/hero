import { useCallback, useMemo, useReducer } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  addToSide,
  removeFromSide,
  canBattle as canBattleFn,
  derivePublisher,
  type PickedHero,
  type Side,
} from '../lib/battleBuilderState';
import { getTeamSynergy } from '../lib/db/teams';
import { getRelatedHeroes } from '../lib/db/heroes';
import { resolveBattleRoute } from '../lib/battleRoute';

export interface BattleBuilder {
  aHeroes: PickedHero[];
  bHeroes: PickedHero[];
  active: Side;
  setActive: (side: Side) => void;
  addToActive: (hero: PickedHero) => void;
  removeHero: (id: string) => void;
  synergyA: number;
  synergyB: number;
  publisherA: 'marvel' | 'dc' | null;
  publisherB: 'marvel' | 'dc' | null;
  teammates: {
    id: string;
    name: string;
    image_url?: string | null;
    portrait_url?: string | null;
  }[];
  isPlaced: (id: string) => boolean;
  canBattle: boolean;
  battleHref: string | null;
}

interface State {
  aHeroes: PickedHero[];
  bHeroes: PickedHero[];
  active: Side;
}
type Action =
  | { type: 'add'; hero: PickedHero }
  | { type: 'remove'; id: string }
  | { type: 'active'; side: Side };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'add':
      return s.active === 'A'
        ? { ...s, aHeroes: addToSide(s.aHeroes, s.bHeroes, a.hero) }
        : { ...s, bHeroes: addToSide(s.bHeroes, s.aHeroes, a.hero) };
    case 'remove':
      return {
        ...s,
        aHeroes: removeFromSide(s.aHeroes, a.id),
        bHeroes: removeFromSide(s.bHeroes, a.id),
      };
    case 'active':
      return { ...s, active: a.side };
  }
}

function useSynergy(ids: string[]): number {
  const key = ids.join(',');
  const q = useQuery({
    queryKey: ['builderSynergy', key],
    enabled: ids.length >= 2,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => Math.round((await getTeamSynergy(ids)).total_pct * 100),
  });
  return ids.length >= 2 ? (q.data ?? 0) : 0;
}

export function useBattleBuilder(): BattleBuilder {
  const [state, dispatch] = useReducer(reducer, { aHeroes: [], bHeroes: [], active: 'A' });
  const { aHeroes, bHeroes, active } = state;

  const aIds = useMemo(() => aHeroes.map((h) => h.id), [aHeroes]);
  const bIds = useMemo(() => bHeroes.map((h) => h.id), [bHeroes]);

  const synergyA = useSynergy(aIds);
  const synergyB = useSynergy(bIds);

  // Teammates of the active side's captain (its first hero), minus anyone placed.
  const captainId = (active === 'A' ? aHeroes : bHeroes)[0]?.id;
  const placedIds = useMemo(() => new Set([...aIds, ...bIds]), [aIds, bIds]);
  const teammatesQ = useQuery({
    queryKey: ['builderTeammates', captainId ?? ''],
    enabled: !!captainId,
    staleTime: 1000 * 60 * 30,
    queryFn: () => getRelatedHeroes(captainId as string, 'teammate', { limit: 20 }),
  });
  const teammates = useMemo(
    () => (teammatesQ.data ?? []).filter((t) => !placedIds.has(t.id)),
    [teammatesQ.data, placedIds],
  );

  const isPlaced = useCallback((id: string) => placedIds.has(id), [placedIds]);

  return {
    aHeroes,
    bHeroes,
    active,
    setActive: useCallback((side: Side) => dispatch({ type: 'active', side }), []),
    addToActive: useCallback((hero: PickedHero) => dispatch({ type: 'add', hero }), []),
    removeHero: useCallback((id: string) => dispatch({ type: 'remove', id }), []),
    synergyA,
    synergyB,
    publisherA: derivePublisher(aHeroes),
    publisherB: derivePublisher(bHeroes),
    teammates,
    isPlaced,
    canBattle: canBattleFn(aHeroes, bHeroes),
    battleHref: useMemo(() => resolveBattleRoute(aIds, bIds), [aIds, bIds]),
  };
}
