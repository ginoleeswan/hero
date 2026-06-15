import { supabase } from '../supabase';
import type { Tables } from '../../types/database.generated';

// Editorial campaigns — admin CRUD for the command center. Reads hit the
// public-read table directly; writes go through the is_admin-gated RPCs.
export type Campaign = Tables<'featured_campaigns'>;

export interface CampaignInput {
  id?: string | null;
  label: string;
  headline: string;
  ends_at: string; // ISO timestamp
  starts_at?: string | null;
  blurb?: string | null;
  accent?: string | null;
  franchise?: string | null;
  title_id?: string | null;
  hero_ids?: string[] | null;
  priority?: number;
}

/** All campaigns (active, scheduled, and expired), priority-first. */
export async function listCampaigns(): Promise<Campaign[]> {
  const { data, error } = await supabase
    .from('featured_campaigns')
    .select('*')
    .order('priority', { ascending: false })
    .order('starts_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Campaign[];
}

/** Insert (no id) or update (with id) a campaign; returns the row id. */
export async function upsertCampaign(input: CampaignInput): Promise<string> {
  const { data, error } = await supabase.rpc('admin_upsert_campaign', {
    p_label: input.label,
    p_headline: input.headline,
    p_ends_at: input.ends_at,
    p_id: input.id ?? undefined,
    p_blurb: input.blurb ?? undefined,
    p_accent: input.accent ?? undefined,
    p_franchise: input.franchise ?? undefined,
    p_title_id: input.title_id ?? undefined,
    p_hero_ids: input.hero_ids ?? undefined,
    p_priority: input.priority ?? 0,
    p_starts_at: input.starts_at ?? undefined,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function deleteCampaign(id: string): Promise<void> {
  const { error } = await supabase.rpc('admin_delete_campaign', { p_id: id });
  if (error) throw new Error(error.message);
}

export type CampaignStatus = 'live' | 'scheduled' | 'ended';

/** Where a campaign sits relative to now — drives the list badge. */
export function campaignStatus(c: Pick<Campaign, 'starts_at' | 'ends_at'>): CampaignStatus {
  const now = Date.now();
  if (new Date(c.ends_at).getTime() < now) return 'ended';
  if (new Date(c.starts_at).getTime() > now) return 'scheduled';
  return 'live';
}
