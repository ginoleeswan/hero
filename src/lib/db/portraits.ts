// AI portrait generation (Gemini → Cloudinary) — the data layer for the
// command-center Portraits runner. A hero needs a portrait when it has a source
// image to redraw from (image_url) but no portrait yet (portrait_url is null).
import { supabase } from '../supabase';

export interface PortraitHero {
  id: string;
  name: string;
  source: string | null; // image_url — the ComicVine art we redraw from
  portrait: string | null; // portrait_url — the generated result (once done)
  status: 'pending' | 'done';
}

/** How many heroes still need an AI portrait (have a source image, no portrait). */
export async function getPendingPortraitCount(): Promise<number> {
  const { count, error } = await supabase
    .from('heroes')
    .select('id', { count: 'exact', head: true })
    .is('portrait_url', null)
    .not('image_url', 'is', null);
  return error ? 0 : (count ?? 0);
}

/** The next heroes that still need a portrait, most-viewed first (capped). */
export async function getPendingPortraitIds(limit = 10): Promise<string[]> {
  const { data, error } = await supabase
    .from('heroes')
    .select('id, issue_count')
    .is('portrait_url', null)
    .not('image_url', 'is', null)
    .order('issue_count', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as { id: string }[]).map((h) => h.id);
}

/** Live state of a portrait working set (source + result + status). */
export async function getPortraitHeroes(ids: string[]): Promise<PortraitHero[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('heroes')
    .select('id, name, image_url, portrait_url')
    .in('id', ids);
  if (error || !data) return [];
  return (
    data as Array<{
      id: string;
      name: string;
      image_url: string | null;
      portrait_url: string | null;
    }>
  ).map((h) => ({
    id: h.id,
    name: h.name,
    source: h.image_url,
    portrait: h.portrait_url,
    status: h.portrait_url ? 'done' : 'pending',
  }));
}

/** Generate the AI portrait for one hero (Gemini → Cloudinary). Idempotent. */
export async function stepPortrait(id: string): Promise<void> {
  const { error } = await supabase.functions.invoke('generate-hero-portrait', {
    body: { heroId: id },
  });
  if (error) throw error;
}
