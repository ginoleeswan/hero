import { supabase } from '../supabase';

// Community contributions (Phase 2a). Submission + the admin review queue go
// through SECURITY DEFINER RPCs; everything is admin-vetted (no auto-approve).
// The editable-field allow-list lives here as the single source of truth shared
// by the submit flow and (later) the hero-page contribute mode.

export type ContributionKind = 'field' | 'fact' | 'report';

/** How a field's value is shaped — drives both the editor input and the
 *  server-side apply path (text column / text[] column / int powerstat). */
export type FieldType = 'text' | 'list' | 'stat';

export interface EditableFieldDef {
  field: string;
  label: string;
  /** A friendly question used as the prompt — "Where was X born?" reads easier
   *  than a form label and makes the ask feel like a one-tap answer. */
  question: string;
  guideline?: string;
  multiline?: boolean;
  /** Defaults to 'text'. 'list' edits a whole text[] (one per line); 'stat' is a
   *  0–100 integer powerstat (admin-only — refused for community submissions). */
  type?: FieldType;
  /** Dossier grouping, so the edit list reads like the read view. */
  group?: 'profile' | 'appearance' | 'connections';
}

/** The Dossier's editable columns, grouped to mirror the read view. Mirrors the
 *  allow-list enforced server-side in _contrib_field_type. */
export const EDITABLE_FIELDS: EditableFieldDef[] = [
  // Profile
  { field: 'full_name', label: 'Full name', question: "What's their real name?", group: 'profile' },
  {
    field: 'alter_egos',
    label: 'Alter egos',
    question: 'Any other identities they go by?',
    group: 'profile',
  },
  {
    field: 'aliases',
    label: 'Aliases',
    question: 'What else are they called?',
    guideline: 'One alias per line.',
    type: 'list',
    multiline: true,
    group: 'profile',
  },
  {
    field: 'place_of_birth',
    label: 'Place of birth',
    question: 'Where were they born?',
    group: 'profile',
  },
  {
    field: 'first_appearance',
    label: 'First appearance',
    question: 'Where did they first appear?',
    guideline: 'The issue or title they debuted in.',
    group: 'profile',
  },
  {
    field: 'origin',
    label: 'Origin',
    question: 'Where does this hero come from?',
    guideline: 'Their origin story — a sentence or two.',
    multiline: true,
    group: 'profile',
  },
  // Appearance
  { field: 'gender', label: 'Gender', question: 'How do they identify?', group: 'appearance' },
  { field: 'race', label: 'Race', question: 'What is their race or species?', group: 'appearance' },
  {
    field: 'height_imperial',
    label: 'Height',
    question: 'How tall are they?',
    guideline: 'e.g. 6′2″',
    group: 'appearance',
  },
  {
    field: 'weight_imperial',
    label: 'Weight',
    question: 'How much do they weigh?',
    guideline: 'e.g. 200 lb',
    group: 'appearance',
  },
  { field: 'eye_color', label: 'Eyes', question: 'What colour are their eyes?', group: 'appearance' },
  { field: 'hair_color', label: 'Hair', question: 'What colour is their hair?', group: 'appearance' },
  // Connections
  { field: 'occupation', label: 'Occupation', question: 'What do they do?', group: 'connections' },
  {
    field: 'base',
    label: 'Base of operations',
    question: 'Where do they operate from?',
    group: 'connections',
  },
  {
    field: 'group_affiliation',
    label: 'Affiliations',
    question: 'Which teams or groups do they belong to?',
    guideline: 'Teams or allies, comma-separated.',
    multiline: true,
    group: 'connections',
  },
];

/** The Summary section's lede — its own pen on the hero page. */
export const SUMMARY_FIELD: EditableFieldDef = {
  field: 'summary',
  label: 'Summary',
  question: 'How would you sum up this hero?',
  guideline: 'A short overview — two or three sentences.',
  multiline: true,
};

/** The Abilities section — the whole powers list, edited one per line. */
export const POWERS_FIELD: EditableFieldDef = {
  field: 'powers',
  label: 'Powers & abilities',
  question: 'What are their powers?',
  guideline: 'One power per line.',
  type: 'list',
  multiline: true,
};

/** Power Stats — admin-only (they feed matchups). Each is a 0–100 integer. */
export const STAT_FIELDS: EditableFieldDef[] = [
  { field: 'intelligence', label: 'Intelligence', question: 'Set intelligence', type: 'stat' },
  { field: 'strength', label: 'Strength', question: 'Set strength', type: 'stat' },
  { field: 'speed', label: 'Speed', question: 'Set speed', type: 'stat' },
  { field: 'durability', label: 'Durability', question: 'Set durability', type: 'stat' },
  { field: 'power', label: 'Power', question: 'Set power', type: 'stat' },
  { field: 'combat', label: 'Combat', question: 'Set combat', type: 'stat' },
].map((f) => ({ ...f, guideline: 'A whole number from 0 to 100.' }) as EditableFieldDef);

/** Dossier edit list, grouped to read like the section it replaces. */
export const DOSSIER_GROUPS: { key: string; label: string; fields: EditableFieldDef[] }[] = [
  { key: 'profile', label: 'Profile', fields: EDITABLE_FIELDS.filter((f) => f.group === 'profile') },
  {
    key: 'appearance',
    label: 'Appearance',
    fields: EDITABLE_FIELDS.filter((f) => f.group === 'appearance'),
  },
  {
    key: 'connections',
    label: 'Connections',
    fields: EDITABLE_FIELDS.filter((f) => f.group === 'connections'),
  },
];

const FIELD_LABEL: Record<string, string> = Object.fromEntries(
  [...EDITABLE_FIELDS, SUMMARY_FIELD, POWERS_FIELD, ...STAT_FIELDS].map((f) => [f.field, f.label]),
);

const FIELD_TYPE: Record<string, FieldType> = Object.fromEntries(
  [...EDITABLE_FIELDS, SUMMARY_FIELD, POWERS_FIELD, ...STAT_FIELDS].map((f) => [
    f.field,
    f.type ?? 'text',
  ]),
);

/** The shape of a field (text/list/stat), or null if it's not an editable field. */
export function fieldTypeOf(targetField: string | null): FieldType | null {
  return targetField ? (FIELD_TYPE[targetField] ?? null) : null;
}

/** Human label for an editable field column ('place_of_birth' → 'Place of birth'). */
export function fieldLabelOf(targetField: string | null): string {
  return FIELD_LABEL[targetField ?? ''] ?? targetField ?? '';
}

/** Parse a Postgres text[] literal ('{a,"b c",NULL}') into a string[]. Used to
 *  read a list field's snapshot (old_value), which is stored as the array's
 *  ::text form. Quoted elements are unescaped; NULL/empty are dropped. */
export function parsePgArrayLiteral(literal: string | null | undefined): string[] {
  if (!literal) return [];
  const s = literal.trim();
  if (!s.startsWith('{') || !s.endsWith('}')) {
    // Not an array literal — fall back to the one-per-line/comma form.
    return splitListInput(literal);
  }
  const inner = s.slice(1, -1);
  if (inner.trim() === '') return [];
  const out: string[] = [];
  let i = 0;
  while (i < inner.length) {
    let val = '';
    if (inner[i] === '"') {
      i++;
      while (i < inner.length && inner[i] !== '"') {
        if (inner[i] === '\\') {
          i++;
          val += inner[i] ?? '';
        } else {
          val += inner[i];
        }
        i++;
      }
      i++; // closing quote
    } else {
      while (i < inner.length && inner[i] !== ',') {
        val += inner[i];
        i++;
      }
      val = val.trim();
      if (val === 'NULL') val = '';
    }
    if (val !== '') out.push(val);
    while (i < inner.length && inner[i] === ',') i++;
  }
  return out;
}

/** Split a "one per line" (or comma-separated) intake into a trimmed list,
 *  dropping blanks — mirrors the server's _parse_str_list so the review diff
 *  matches what will actually be written. */
export function splitListInput(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[\n,]/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

export interface ListDiff {
  added: string[];
  removed: string[];
  /** The resulting list (what the field becomes), in order. */
  next: string[];
}

/** Diff a list field for review: what's added vs. removed between the stored
 *  old value (array literal) and the proposed new value (one-per-line). */
export function diffListValues(
  oldLiteral: string | null | undefined,
  newRaw: string | null | undefined,
): ListDiff {
  const prev = parsePgArrayLiteral(oldLiteral);
  const next = splitListInput(newRaw);
  const prevSet = new Set(prev.map((v) => v.toLowerCase()));
  const nextSet = new Set(next.map((v) => v.toLowerCase()));
  return {
    added: next.filter((v) => !prevSet.has(v.toLowerCase())),
    removed: prev.filter((v) => !nextSet.has(v.toLowerCase())),
    next,
  };
}

/** Human description of what a contribution changed, for the profile list. */
export function describeContribution(c: {
  kind: ContributionKind;
  target_field: string | null;
}): string {
  if (c.kind === 'fact') return 'Did You Know fact';
  if (c.kind === 'report') return 'Reported an issue';
  return FIELD_LABEL[c.target_field ?? ''] ?? c.target_field ?? 'Edit';
}

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
