import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTeamsByNames } from '../lib/db/teams';

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Resolve a hero's affiliation names to team ids so the character-page
 * affiliation chips can link to /team/[id]. Returns a lookup `(name) => id?`:
 * names that match a real team are tappable, the rest stay plain text. Shared by
 * the native and web character views so they can't drift.
 */
export function useHeroTeams(
  names: string[] | null | undefined,
): (name: string) => string | undefined {
  const unique = useMemo(
    () => Array.from(new Set((names ?? []).map((n) => n.trim()).filter(Boolean))),
    [names],
  );

  const { data } = useQuery({
    queryKey: ['teamsByNames', [...unique].sort()],
    enabled: unique.length > 0,
    queryFn: () => getTeamsByNames(unique),
    staleTime: 5 * 60 * 1000,
  });

  return useMemo(() => {
    const idByName = new Map<string, string>();
    for (const t of data ?? []) idByName.set(norm(t.name), t.id);
    return (name: string) => idByName.get(norm(name));
  }, [data]);
}
