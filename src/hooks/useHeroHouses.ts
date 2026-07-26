// src/hooks/useHeroHouses.ts
// The houses a character belongs to, for the link out of their family section.
//
// This is the discovery path. A house page nothing links to is a page nobody
// reaches, and a character's own family section is exactly where someone is
// already thinking about their relatives.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface HeroHouse {
  slug: string;
  name: string;
  sigil_tint: string | null;
}

export function useHeroHouses(heroId: string | null | undefined): HeroHouse[] {
  const { data } = useQuery({
    queryKey: ['heroHouses', heroId],
    enabled: !!heroId,
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<HeroHouse[]> => {
      const { data: rows, error } = await supabase
        .from('house_members')
        .select('houses(slug, name, sigil_tint)')
        .eq('hero_id', heroId!);
      if (error) throw new Error(error.message);
      // Jon Snow is in two, which is the most interesting fact in the dataset
      // and worth showing rather than picking one.
      return (rows ?? [])
        .map((r) => (r as unknown as { houses: HeroHouse | null }).houses)
        .filter((h): h is HeroHouse => !!h);
    },
  });
  return data ?? [];
}
