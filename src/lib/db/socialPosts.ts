import { supabase } from '../supabase';

// Social posting queue — published from the local studio (publish-posts.mjs),
// consumed by the command-center Social lane. Reads/updates are admin-gated RLS.
//
// NOTE: `social_posts` is not in database.generated.ts yet (regenerate after the
// migration lands); the local row type below keeps callers fully typed.
export interface SocialPost {
  id: string;
  batch: string; // 'launch' | 'week-YYYY-MM-DD'
  ord: number;
  day: string | null;
  kind: string;
  title: string;
  image_url: string;
  slide_urls: string[];
  caption: string;
  guide_where: string | null;
  guide_when: string | null;
  posted_at: string | null;
  created_at: string;
}

// Typed escape hatch until the generated types include social_posts.
const table = () => supabase.from('social_posts' as never) as never as {
  select: (cols: string) => {
    order: (
      col: string,
      opts?: { ascending?: boolean },
    ) => PromiseLike<{ data: unknown; error: { message: string } | null }> & {
      order: (
        col: string,
        opts?: { ascending?: boolean },
      ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
    };
  };
  update: (values: Record<string, unknown>) => {
    eq: (col: string, v: string) => PromiseLike<{ error: { message: string } | null }>;
  };
};

/** All published posts, launch batch first, then weeks (newest first), in order. */
export async function listSocialPosts(): Promise<SocialPost[]> {
  const { data, error } = await table().select('*').order('batch', { ascending: false }).order('ord', { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as SocialPost[];
  // 'launch' sorts after 'week-*' descending; surface it first explicitly.
  return [...rows.filter((r) => r.batch === 'launch'), ...rows.filter((r) => r.batch !== 'launch')];
}

/** Toggle posted state (stores/clears the timestamp). */
export async function setSocialPosted(id: string, posted: boolean): Promise<void> {
  const { error } = await table()
    .update({ posted_at: posted ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) throw new Error(error.message);
}
