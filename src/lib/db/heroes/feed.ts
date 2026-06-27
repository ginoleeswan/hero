import { supabase } from '../../supabase';
import type { Hero } from './types';

// Minimal column sets for home page queries — cards only need image + name.
// Spotlight panel also shows publisher and summary.
const HOME_ROW = 'id, name, image_url, portrait_url';
const HOME_SPOT =
  'id, name, image_url, portrait_url, publisher, summary, full_name, alignment, first_appearance, intelligence, strength, speed, durability, power, combat';

export async function getPopularHeroes(limit = 25): Promise<Hero[]> {
  const { data, error } = await supabase
    .from('heroes')
    .select(HOME_SPOT)
    .eq('category', 'popular')
    .order('fame_score', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Hero[];
}

export async function getXMen(limit = 25): Promise<Hero[]> {
  const { data, error } = await supabase
    .from('heroes')
    .select(HOME_ROW)
    .or('group_affiliation.ilike.%x-men%,group_affiliation.ilike.%xmen%')
    .order('fame_score', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Hero[];
}

export async function getAntiHeroes(limit = 20): Promise<Hero[]> {
  const { data, error } = await supabase
    .from('heroes')
    .select(HOME_ROW)
    .ilike('alignment', '%neutral%')
    .order('fame_score', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Hero[];
}

export async function getVillains(limit = 25): Promise<Hero[]> {
  const { data, error } = await supabase
    .from('heroes')
    .select(HOME_ROW)
    .eq('alignment', 'bad')
    .not('publisher', 'in', '("Non-Fictional","In the Public Domain")')
    .order('fame_score', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Hero[];
}

export async function getIconicHeroes(limit = 25): Promise<Hero[]> {
  const { data, error } = await supabase
    .from('heroes')
    .select(HOME_SPOT)
    .not('publisher', 'in', '("Non-Fictional","In the Public Domain","Company-Licensed")')
    .order('fame_score', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Hero[];
}

// Spotlight billboard rules: a portrait is mandatory (it fills a half-screen
// stage — a square image_url cropped to that height looks broken), and the hero
// must be enriched (summary present) so the detail screen they tap into is full.
// We mix mostly marquee names (≥2 movies) with ~1-in-5 lesser-known "discovery"
// heroes, sampling fresh from each tier on every load so the lineup rotates.
const SPOT_PUBLISHER_EXCLUDE = '("Non-Fictional","In the Public Domain","Company-Licensed")';
const SPOT_FAMOUS_POOL = 20; // deep enough to vary, shallow enough to stay A-list
const SPOT_DISCOVERY_POOL = 50;
const SPOT_MIN_POWERSTATS = 200; // floor that filters out civilian sidekicks

function sampleN<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

export async function getSpotlightHeroes(limit = 5): Promise<Hero[]> {
  const discoveryCount = Math.max(1, Math.round(limit * 0.2));
  const famousCount = Math.max(0, limit - discoveryCount);

  // The powerstats floor keeps the billboard to actual heroes/villains: it drops
  // famous-by-association civilians (Alfred, Lois Lane, Jimmy Olsen, Goofy…) who
  // inherit their franchise's film count, while still keeping low-stat but real
  // heroes like Hawkeye and Ant-Man.
  const famousQuery = supabase
    .from('heroes')
    .select(HOME_SPOT)
    .not('portrait_url', 'is', null)
    .not('summary', 'is', null)
    .gte('movie_count', 2)
    .gte('powerstats_total', SPOT_MIN_POWERSTATS)
    .not('publisher', 'in', SPOT_PUBLISHER_EXCLUDE)
    .order('movie_count', { ascending: false, nullsFirst: false })
    .order('fame_score', { ascending: false, nullsFirst: false })
    .limit(SPOT_FAMOUS_POOL);

  // Lesser-known but not obscure: no/few films, yet a real publication history.
  const discoveryQuery = supabase
    .from('heroes')
    .select(HOME_SPOT)
    .not('portrait_url', 'is', null)
    .not('summary', 'is', null)
    .or('movie_count.is.null,movie_count.lt.2')
    .gte('issue_count', 200)
    .gte('powerstats_total', SPOT_MIN_POWERSTATS)
    .not('publisher', 'in', SPOT_PUBLISHER_EXCLUDE)
    .order('issue_count', { ascending: false, nullsFirst: false })
    .limit(SPOT_DISCOVERY_POOL);

  const [famousRes, discoveryRes] = await Promise.all([famousQuery, discoveryQuery]);
  if (famousRes.error) throw new Error(famousRes.error.message);
  if (discoveryRes.error) throw new Error(discoveryRes.error.message);

  const famous = sampleN((famousRes.data ?? []) as unknown as Hero[], famousCount);
  const discovery = sampleN((discoveryRes.data ?? []) as unknown as Hero[], discoveryCount);

  // Shuffle the merged set so the discovery hero isn't pinned to the last slot.
  return sampleN([...famous, ...discovery], limit);
}

/**
 * Billboard-ready heroes who are currently on screen — the top of the on_screen
 * trending bucket, filtered to those that satisfy the spotlight's gates (portrait
 * + summary + real powerstats). Prepended to the spotlight pool so the billboard
 * leads with characters audiences are seeing in theaters right now.
 */
export async function getTrendingSpotlightHeroes(limit = 2): Promise<Hero[]> {
  const { data: trend, error: trendErr } = await supabase.rpc('get_trending_heroes', {
    p_bucket: 'on_screen',
    p_limit: 40,
  });
  if (trendErr || !trend?.length) return [];
  const ids = (trend as { id: string }[]).map((t) => t.id);
  const { data, error } = await supabase
    .from('heroes')
    .select(HOME_SPOT)
    .in('id', ids)
    .not('portrait_url', 'is', null)
    .not('summary', 'is', null)
    .gte('powerstats_total', SPOT_MIN_POWERSTATS);
  if (error) {
    console.warn('[getTrendingSpotlightHeroes] error:', error.message);
    return [];
  }
  const order = new Map(ids.map((id, i) => [id, i]));
  return ((data ?? []) as unknown as Hero[])
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    .slice(0, limit);
}

export async function getNewlyAddedCV(limit = 25): Promise<Hero[]> {
  const { data, error } = await supabase
    .from('heroes')
    .select(HOME_ROW)
    .like('id', 'cv-%')
    .not('publisher', 'in', '("Non-Fictional","In the Public Domain")')
    // Order by when the hero entered the catalog, not issue_count — otherwise the
    // genuinely-new characters (low issue_count) sink below long-running heroes.
    .order('added_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Hero[];
}

// ── Franchise / pop-culture cohort (famous shows · movies · games · anime) ────
// These characters arrive enriched (portraits, summaries, curated stats) but with
// tiny issue_counts, so every issue_count-ranked row buries them. The franchise
// column + media tags let the Explore page feature them on their own terms.

/** The marquee "Beyond the Comics" row — characters tagged with a franchise,
 *  ranked by power so the lineup leads with heavy hitters and reads premium.
 *  Portrait required (these fill hero cards). */
export async function getFranchiseIcons(limit = 20): Promise<Hero[]> {
  const { data, error } = await supabase
    .from('heroes')
    .select(HOME_ROW)
    .not('franchise', 'is', null)
    .not('portrait_url', 'is', null)
    .order('powerstats_total', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Hero[];
}

/** Themed franchise row by media tag (anime / video-game / horror-icon /
 *  screen-icon / toy-cartoon), ranked by popularity within the theme. */
export async function getHeroesByMediaTag(tag: string, limit = 20): Promise<Hero[]> {
  const { data, error } = await supabase
    .from('heroes')
    .select(`${HOME_ROW}, hero_tags!inner(tag)`)
    .eq('hero_tags.tag', tag)
    .order('fame_score', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Hero[];
}

export async function getHeroesByPublisher(publisher: string, limit = 25): Promise<Hero[]> {
  const { data, error } = await supabase
    .from('heroes')
    .select(HOME_ROW)
    .ilike('publisher', `%${publisher}%`)
    .order('fame_score', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Hero[];
}

export async function getHeroesByStatRanking(
  stat: 'strength' | 'intelligence',
  limit = 20,
): Promise<Hero[]> {
  const { data, error } = await supabase
    .from('heroes')
    .select(`${HOME_ROW}, intelligence, strength, speed`)
    .not(stat, 'is', null)
    .order(stat, { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Hero[];
}
