import { supabase } from '../supabase';
import type { CauseKind, PulseCandidate, PulseKind } from '../home/pulse';

// Candidates for the Pulse rail — every timestamped thing the catalogue knows
// happened. The RPC selects by recency only; ranking, decay and all user-facing
// copy live in src/lib/home/pulse.ts where they're unit-tested.

interface PulseCandidateRow {
  kind: string;
  event_id: string;
  entity_id: string;
  headline: string;
  subtype: string | null;
  image_url: string | null;
  accent: string | null;
  occurred_at: string | null;
  media_key: string | null;
  release_date: string | null;
  provider: string | null;
  publisher: string | null;
  character_count: number | null;
  max_fame: number | null;
  window_from?: string | null;
  window_to?: string | null;
  edition_slug?: string | null;
  cause_kind?: string | null;
  cause_label?: string | null;
  cause_date?: string | null;
  cause_confidence?: string | null;
}

const KINDS: readonly PulseKind[] = ['live_event', 'trailer', 'surge', 'issue'];
const CAUSE_KINDS: readonly CauseKind[] = ['trailer', 'issue', 'live_event'];

/** Flat RPC rows → PulseCandidate. Rows of an unrecognised kind are dropped
 *  rather than passed through: the ranker keys weights and half-lives off `kind`,
 *  and an unknown one would score as undefined. */
export function mapPulseRows(rows: PulseCandidateRow[]): PulseCandidate[] {
  const out: PulseCandidate[] = [];
  for (const r of rows) {
    if (!KINDS.includes(r.kind as PulseKind)) continue;
    out.push({
      kind: r.kind as PulseKind,
      eventId: r.event_id,
      entityId: r.entity_id,
      headline: r.headline,
      subtype: r.subtype,
      imageUrl: r.image_url,
      accent: r.accent,
      occurredAt: r.occurred_at,
      mediaKey: r.media_key,
      releaseDate: r.release_date,
      provider: r.provider,
      publisher: r.publisher,
      characterCount: r.character_count ?? 0,
      maxFame: r.max_fame,
      // Optional at the row level: the columns land with
      // 20260726230000_pulse_event_window.sql, and the reader must keep working
      // against the older signature until that's applied.
      windowFrom: r.window_from ?? null,
      windowTo: r.window_to ?? null,
      // Optional at the row level for the same reason as the window columns:
      // the reader must keep working against an RPC that predates the column.
      editionSlug: r.edition_slug ?? null,
      // Optional at the row level: the columns land with
      // 20260727181000_pulse_candidates_with_cause.sql, and the reader keeps
      // working against the older signature until that's applied.
      causeKind: CAUSE_KINDS.includes(r.cause_kind as CauseKind)
        ? (r.cause_kind as CauseKind)
        : null,
      causeLabel: r.cause_label ?? null,
      causeDate: r.cause_date ?? null,
      causeConfidence: r.cause_confidence === 'high' ? 'high' : r.cause_confidence ? 'low' : null,
    });
  }
  return out;
}

/** Degrades to [] so a DB hiccup — or an unapplied migration — leaves the band
 *  exactly as it was rather than erroring. */
export async function getPulseCandidates(perKind = 20): Promise<PulseCandidate[]> {
  const { data, error } = await supabase.rpc('get_pulse_candidates', {
    p_per_kind: perKind,
  });
  if (error) {
    console.warn('[getPulseCandidates] error:', error.message);
    return [];
  }
  // The generated Returns marks every column non-null — a RETURNS TABLE signature
  // carries no nullability — so widen to the row shape this actually guards for.
  return mapPulseRows((data ?? []) as PulseCandidateRow[]);
}
