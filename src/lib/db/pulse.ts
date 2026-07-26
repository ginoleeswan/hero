import { supabase } from '../supabase';
import type { PulseCandidate, PulseKind } from '../home/pulse';

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
}

const KINDS: readonly PulseKind[] = ['live_event', 'trailer', 'issue'];

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
    });
  }
  return out;
}

/** Degrades to [] so a DB hiccup — or an unapplied migration — leaves the band
 *  exactly as it was rather than erroring. */
export async function getPulseCandidates(perKind = 20): Promise<PulseCandidate[]> {
  // `as never`: the RPC lands with 20260726220000_pulse_candidates.sql, so it
  // isn't in database.generated.ts until that's applied and types regenerated.
  const { data, error } = await supabase.rpc(
    'get_pulse_candidates' as never,
    {
      p_per_kind: perKind,
    } as never,
  );
  if (error) {
    console.warn('[getPulseCandidates] error:', error.message);
    return [];
  }
  return mapPulseRows((data ?? []) as unknown as PulseCandidateRow[]);
}
