import { supabase } from '../supabase';
import type { Tables } from '../../types/database.generated';

// Social posting queue — published from the local studio (publish-posts.mjs),
// consumed by the command-center Social lane. Reads/updates are admin-gated RLS.
export type SocialPost = Tables<'social_posts'>;

/** All published posts, launch batch first, then weeks (newest first), in order. */
export async function listSocialPosts(): Promise<SocialPost[]> {
  const { data, error } = await supabase
    .from('social_posts')
    .select('*')
    .order('batch', { ascending: false })
    .order('ord', { ascending: true });
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  // 'launch' sorts after 'week-*' descending; surface it first explicitly.
  return [...rows.filter((r) => r.batch === 'launch'), ...rows.filter((r) => r.batch !== 'launch')];
}

/** Toggle posted state (stores/clears the timestamp). */
export async function setSocialPosted(id: string, posted: boolean): Promise<void> {
  const { error } = await supabase
    .from('social_posts')
    .update({ posted_at: posted ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) throw new Error(error.message);
}
