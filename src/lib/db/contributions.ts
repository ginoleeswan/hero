import { supabase } from '../supabase';

// Community contributions (Phase 2a). Submission + the admin review queue go
// through SECURITY DEFINER RPCs; everything is admin-vetted (no auto-approve).
// The editable-field allow-list lives here as the single source of truth shared
// by the submit flow and (later) the hero-page contribute mode.

export type ContributionKind = 'field' | 'fact' | 'report';

export interface EditableFieldDef {
  field: string;
  label: string;
  guideline?: string;
  multiline?: boolean;
}

/** The heroes text columns a contributor may propose. Mirrors the allow-list
 *  enforced server-side in submit_contribution / admin_review_contribution. */
export const EDITABLE_FIELDS: EditableFieldDef[] = [
  {
    field: 'origin',
    label: 'Origin',
    guideline: 'Where this hero comes from — a sentence or two.',
    multiline: true,
  },
  { field: 'full_name', label: 'Full name', guideline: 'Their real or birth name.' },
  { field: 'occupation', label: 'Occupation', guideline: 'What they do.' },
  { field: 'base', label: 'Base of operations', guideline: 'Where they operate from.' },
  { field: 'place_of_birth', label: 'Place of birth' },
  {
    field: 'first_appearance',
    label: 'First appearance',
    guideline: 'The issue or title they debuted in.',
  },
];

export interface MyContribution {
  id: number;
  hero_id: string;
  hero_name: string;
  kind: ContributionKind;
  target_field: string | null;
  new_value: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'superseded';
  reject_reason: string | null;
  created_at: string;
}

export interface ReviewItem {
  id: number;
  hero_id: string;
  hero_name: string;
  kind: ContributionKind;
  target_field: string | null;
  old_value: string | null;
  new_value: string | null;
  note: string | null;
  created_at: string;
  user_id: string;
  submitter: string | null;
}

export type SubmitResult = { ok: true; id: number } | { ok: false; error: string };

/** Queue a contribution for admin review. */
export async function submitContribution(opts: {
  heroId: string;
  kind: ContributionKind;
  targetField?: string | null;
  newValue?: string | null;
  note?: string | null;
}): Promise<SubmitResult> {
  // RPC args are non-null text; pass '' for the slots a given kind doesn't use
  // (the function only reads target_field for kind='field', etc.).
  const { data, error } = await supabase.rpc('submit_contribution', {
    p_hero_id: opts.heroId,
    p_kind: opts.kind,
    p_target_field: opts.targetField ?? '',
    p_new_value: opts.newValue ?? '',
    p_note: opts.note ?? '',
  });
  if (error) return { ok: false, error: error.message };
  const d = (data ?? {}) as { id?: number };
  return { ok: true, id: d.id ?? 0 };
}

/** The caller's own contributions, newest first. */
export async function getMyContributions(): Promise<MyContribution[]> {
  const { data, error } = await supabase.rpc('get_my_contributions');
  if (error) {
    console.warn('[getMyContributions] error:', error.message);
    return [];
  }
  return (data ?? []) as unknown as MyContribution[];
}

// ── Admin ─────────────────────────────────────────────────────────────────────

/** The pending review queue (admin-only; returns [] for non-admins). */
export async function getReviewQueue(limit = 50, offset = 0): Promise<ReviewItem[]> {
  const { data, error } = await supabase.rpc('admin_review_queue', {
    p_limit: limit,
    p_offset: offset,
  });
  if (error) {
    console.warn('[getReviewQueue] error:', error.message);
    return [];
  }
  return (data ?? []) as unknown as ReviewItem[];
}

/** Approve or reject a contribution (admin-only). Applies the change on approve. */
export async function reviewContribution(
  id: number,
  decision: 'approve' | 'reject',
  reason?: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc('admin_review_contribution', {
    p_id: id,
    p_decision: decision,
    p_reason: reason ?? '',
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
