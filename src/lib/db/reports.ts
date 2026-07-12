import { supabase } from '../supabase';

// User-facing report/moderation data layer. Signed-in only; all writes go
// through SECURITY DEFINER RPCs (submit_report is the sole insert path). Keep
// REPORT_REASONS in sync with the _report_reason_ok guard in the reports
// backbone migration.

export type ReportContext = 'page' | 'image' | 'take';
export type ReportTargetType = 'page' | 'image' | 'ai_portrait' | 'take';
export type ReportStatus = 'open' | 'resolved' | 'dismissed';

export interface ReasonOption {
  code: string;
  label: string;
}

/** Reasons offered per entry-point context. The page "ai_inaccurate" reason is
 *  remapped by resolveReportTarget to the ai_portrait target. Keep the 'take'
 *  list in sync with the `_report_reason_ok` guard for target 'take'. */
export const REPORT_REASONS: Record<ReportContext, ReasonOption[]> = {
  page: [
    { code: 'inaccurate', label: 'Incorrect information' },
    { code: 'ai_inaccurate', label: "The main image doesn't look right" },
    { code: 'offensive', label: 'Offensive or inappropriate' },
    { code: 'duplicate', label: 'Duplicate character' },
    { code: 'spam', label: 'Spam' },
    { code: 'other', label: 'Something else' },
  ],
  image: [
    { code: 'wrong_subject', label: "This isn't the right character" },
    { code: 'offensive', label: 'Offensive or inappropriate' },
    { code: 'low_quality', label: 'Low quality / broken image' },
    { code: 'other', label: 'Something else' },
  ],
  take: [
    { code: 'offensive', label: 'Offensive or inappropriate' },
    { code: 'spam', label: 'Spam' },
    { code: 'other', label: 'Something else' },
  ],
};

/** Resolve the stored target_type + image_url from the sheet context and the
 *  chosen reason. Page + "ai_inaccurate" → the single AI portrait. */
export function resolveReportTarget(
  context: ReportContext,
  reasonCode: string,
  refs: { imageUrl?: string | null; portraitUrl?: string | null },
): { targetType: ReportTargetType; imageUrl: string | null } {
  if (context === 'image') return { targetType: 'image', imageUrl: refs.imageUrl ?? null };
  if (context === 'take') return { targetType: 'take', imageUrl: null };
  if (reasonCode === 'ai_inaccurate')
    return { targetType: 'ai_portrait', imageUrl: refs.portraitUrl ?? null };
  return { targetType: 'page', imageUrl: null };
}

export type SubmitResult = { ok: true; id: number } | { ok: false; error: string };

/** File a report. Signed-in only (RPC rejects anon). `takeId` is required
 *  (and only meaningful) for targetType 'take'. */
export async function submitReport(opts: {
  heroId: string;
  targetType: ReportTargetType;
  imageUrl?: string | null;
  reason: string;
  detail?: string | null;
  takeId?: string | null;
}): Promise<SubmitResult> {
  const { data, error } = await supabase.rpc('submit_report', {
    p_hero_id: opts.heroId,
    p_target_type: opts.targetType,
    p_image_url: opts.imageUrl ?? '',
    p_reason: opts.reason,
    p_detail: opts.detail ?? '',
    p_take_id: opts.takeId ?? undefined,
  });
  if (error) return { ok: false, error: error.message };
  const d = (data ?? {}) as { id?: number };
  return { ok: true, id: d.id ?? 0 };
}

export interface ReportRow {
  id: number;
  hero_id: string;
  hero_name: string;
  hero_portrait_url: string | null;
  target_type: ReportTargetType;
  image_url: string | null;
  reason: string;
  detail: string | null;
  status: ReportStatus;
  resolution_note: string | null;
  created_at: string;
  user_id: string;
  submitter: string | null;
}

/** Admin: the reports queue for a status, optionally filtered by reason.
 *  Returns [] for non-admins (silent lock) and on error. */
export async function fetchReportsQueue(
  status: ReportStatus = 'open',
  reason?: string | null,
): Promise<ReportRow[]> {
  const { data, error } = await supabase.rpc('admin_reports_queue', {
    p_status: status,
    p_reason: reason ?? '',
    p_limit: 100,
    p_offset: 0,
  });
  if (error) {
    console.warn('[fetchReportsQueue] error:', error.message);
    return [];
  }
  return (data ?? []) as unknown as ReportRow[];
}

/** Admin: resolve or dismiss a report. */
export async function resolveReport(
  id: number,
  decision: 'resolve' | 'dismiss',
  note?: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc('admin_resolve_report', {
    p_id: id,
    p_decision: decision,
    p_note: note ?? '',
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
