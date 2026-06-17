import { supabase } from '../supabase';

// Community contributions (Phase 2a). Submission + the admin review queue go
// through SECURITY DEFINER RPCs; everything is admin-vetted (no auto-approve).
// The editable-field allow-list lives here as the single source of truth shared
// by the submit flow and (later) the hero-page contribute mode.

export type ContributionKind = 'field' | 'fact' | 'report';

export interface EditableFieldDef {
  field: string;
  label: string;
  /** A friendly question used as the prompt — "Where was X born?" reads easier
   *  than a form label and makes the ask feel like a one-tap answer. */
  question: string;
  guideline?: string;
  multiline?: boolean;
}

/** The heroes text columns a contributor may propose. Mirrors the allow-list
 *  enforced server-side in submit_contribution / admin_review_contribution. */
export const EDITABLE_FIELDS: EditableFieldDef[] = [
  {
    field: 'origin',
    label: 'Origin',
    question: 'Where does this hero come from?',
    guideline: 'Their origin story — a sentence or two.',
    multiline: true,
  },
  { field: 'full_name', label: 'Full name', question: "What's their real name?" },
  { field: 'occupation', label: 'Occupation', question: 'What do they do?' },
  { field: 'base', label: 'Base of operations', question: 'Where do they operate from?' },
  { field: 'place_of_birth', label: 'Place of birth', question: 'Where were they born?' },
  {
    field: 'first_appearance',
    label: 'First appearance',
    question: 'Where did they first appear?',
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

/**
 * Admin direct-edit — applies a field edit or fact immediately (no queue) and
 * logs an auto-approved contribution for the audit trail. Admin-only (guarded
 * server-side). Used by the on-page contribute flow when the viewer is an admin.
 */
export async function adminEditHero(opts: {
  heroId: string;
  kind: 'field' | 'fact';
  targetField?: string | null;
  newValue: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc('admin_edit_hero', {
    p_hero_id: opts.heroId,
    p_kind: opts.kind,
    p_target_field: opts.targetField ?? '',
    p_new_value: opts.newValue,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
