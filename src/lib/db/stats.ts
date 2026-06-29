// Powerstats generation (Gemini) — the data layer for the command-center runner.
// A hero needs stats when ComicVine has given Gemini something to reason from
// (comicvine_status = 'done') and the six dials haven't been generated yet
// (ai_stats_status null/pending — 'done'/'failed' are terminal, skipped by the fn).
import { supabase } from '../supabase';

export interface HeroStatValues {
  intelligence: number;
  strength: number;
  speed: number;
  durability: number;
  power: number;
  combat: number;
}

export interface StatsHero {
  id: string;
  name: string;
  image: string | null;
  status: 'pending' | 'done' | 'failed';
  // The six dials, once generated — drives the live reveal in the runner.
  stats: HeroStatValues | null;
}

export const STAT_KEYS: { key: keyof HeroStatValues; label: string }[] = [
  { key: 'intelligence', label: 'INT' },
  { key: 'strength', label: 'STR' },
  { key: 'speed', label: 'SPD' },
  { key: 'durability', label: 'DUR' },
  { key: 'power', label: 'PWR' },
  { key: 'combat', label: 'CBT' },
];

const PENDING = 'ai_stats_status.is.null,ai_stats_status.eq.pending';

/** How many heroes still need powerstats (drives the runner's badge). */
export async function getPendingStatsCount(): Promise<number> {
  const { count, error } = await supabase
    .from('heroes')
    .select('id', { count: 'exact', head: true })
    .eq('comicvine_status', 'done')
    .or(PENDING);
  return error ? 0 : (count ?? 0);
}

/** The next heroes that still need powerstats, most-recognizable first (capped). */
export async function getPendingStatsIds(limit = 25): Promise<string[]> {
  const { data, error } = await supabase
    .from('heroes')
    .select('id')
    .eq('comicvine_status', 'done')
    .or(PENDING)
    .order('fame_score', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as { id: string }[]).map((h) => h.id);
}

/** Live state of a stats working set, from ai_stats_status. */
export async function getStatsHeroes(ids: string[]): Promise<StatsHero[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('heroes')
    .select(
      'id, name, image_md_url, image_url, portrait_url, ai_stats_status, intelligence, strength, speed, durability, power, combat',
    )
    .in('id', ids);
  if (error || !data) return [];
  return (
    data as {
      id: string;
      name: string;
      image_md_url: string | null;
      image_url: string | null;
      portrait_url: string | null;
      ai_stats_status: string | null;
      intelligence: number | null;
      strength: number | null;
      speed: number | null;
      durability: number | null;
      power: number | null;
      combat: number | null;
    }[]
  ).map((h) => {
    const status =
      h.ai_stats_status === 'done' ? 'done' : h.ai_stats_status === 'failed' ? 'failed' : 'pending';
    return {
      id: h.id,
      name: h.name,
      image: h.portrait_url ?? h.image_md_url ?? h.image_url,
      status,
      stats:
        status === 'done'
          ? {
              intelligence: h.intelligence ?? 0,
              strength: h.strength ?? 0,
              speed: h.speed ?? 0,
              durability: h.durability ?? 0,
              power: h.power ?? 0,
              combat: h.combat ?? 0,
            }
          : null,
    };
  });
}

/** Generate powerstats for one hero (Gemini). Idempotent — done/failed are skipped. */
export async function stepStats(id: string): Promise<void> {
  const { error } = await supabase.functions.invoke('generate-hero-stats', {
    body: { heroId: id },
  });
  if (error) throw error;
}
