import { useMemo } from 'react';
import {
  useHeroRow,
  useHeroRoster,
  usePickRelations,
  useHeroesByPowerRange,
} from '../lib/query/heroQueries';
import type { HeroSearchResult, HeroPowerResult, RelatedHeroCard } from '../lib/db/heroes';

export interface PickSubject {
  id: string;
  name: string;
  image_url: string | null;
  portrait_url: string | null;
}

export interface PickOpponents {
  /** The hero we're choosing an opponent for (for the context anchor). */
  subject: PickSubject | null;
  /** Sworn enemies — from the relationship graph (same-universe + curated). */
  rivals: RelatedHeroCard[];
  /** Allies + teammates — "fight your own side". */
  friendlyFire: RelatedHeroCard[];
  /** Relatives with their own page — "settle it in the family". */
  family: RelatedHeroCard[];
  /** Same-publisher roster (excludes the relationship rows above). */
  sameUniverse: HeroSearchResult[];
  /** Top icons from the *other* major universe — cross-universe dream matches. */
  dreamMatches: HeroSearchResult[];
  /** Heroes of a comparable power level. */
  similar: HeroPowerResult[];
  /** Every other hero, portrait-first, for the full grid + search. */
  all: HeroSearchResult[];
  loading: boolean;
}

const pubKey = (p?: string | null): 'marvel' | 'dc' | 'other' => {
  const s = (p ?? '').toLowerCase();
  if (s.includes('marvel')) return 'marvel';
  if (s.includes('dc')) return 'dc';
  return 'other';
};

const EMPTY: Omit<PickOpponents, 'loading'> = {
  subject: null,
  rivals: [],
  friendlyFire: [],
  family: [],
  sameUniverse: [],
  dreamMatches: [],
  similar: [],
  all: [],
};

/**
 * Single source of truth for the opponent-picker screen — a "matchup menu" of
 * distinct reasons to fight, each drawn from the relationship graphs and the
 * roster. The raw fetches are cached React Query hooks (roster / relations /
 * power-range / the subject row, shared with the character screen); the rows are
 * derived here, with cross-row de-duping that keeps a hero in its most dramatic
 * row only.
 */
export function usePickOpponents(hero: string, fallbackName?: string): PickOpponents {
  const subjectRow = useHeroRow(hero || undefined).data;
  const roster = useHeroRoster().data;
  const relations = usePickRelations(hero || undefined).data;

  // Power band for "comparable power" — only meaningful for an enriched subject,
  // so a non-enriched hero leaves hi=0 and the query stays disabled.
  const total = subjectRow?.enriched_at
    ? (subjectRow.intelligence ?? 0) +
      (subjectRow.strength ?? 0) +
      (subjectRow.speed ?? 0) +
      (subjectRow.durability ?? 0) +
      (subjectRow.power ?? 0) +
      (subjectRow.combat ?? 0)
    : 0;
  const margin = Math.round(total * 0.18);
  const similarRaw = useHeroesByPowerRange(total - margin, total + margin, hero || '').data;

  const derived = useMemo(() => {
    if (!subjectRow || !roster || !relations) return null;
    const { rivals: dbRivals, teammates, allies, family: familyRows } = relations;

    const subjectName = subjectRow.name ?? fallbackName ?? 'this hero';
    const subject: PickSubject = {
      id: hero,
      name: subjectName,
      image_url: subjectRow.image_url ?? null,
      portrait_url: subjectRow.portrait_url ?? null,
    };

    const isSelf = (name: string | null) =>
      !!name && name.toLowerCase() === subjectName.toLowerCase();

    // Rivals lead; `seen` then keeps each hero in its most dramatic row only.
    const seen = new Set<string>();
    const keep = (r: { id: string; name: string }) => {
      if (r.id === hero || isSelf(r.name) || seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    };
    const rivals = dbRivals.filter(keep);

    // Friendly fire — allies + teammates, minus anyone already a rival.
    const friendlyFire = [...teammates, ...allies].filter(keep);

    // Bloodline — family is its own table; only exclude self/dupes.
    const famSeen = new Set<string>();
    const family = familyRows.filter((r) => {
      if (r.id === hero || isSelf(r.name) || famSeen.has(r.id)) return false;
      famSeen.add(r.id);
      return true;
    });
    for (const f of family) seen.add(f.id); // keep family out of the generic rows

    const rosterClean = roster.filter((h) => h.id !== hero && !isSelf(h.name));
    const all = [...rosterClean].sort((a, b) => {
      const scoreA = a.portrait_url ? 2 : a.image_url ? 1 : 0;
      const scoreB = b.portrait_url ? 2 : b.image_url ? 1 : 0;
      return scoreB - scoreA;
    });

    // Same universe — same publisher, minus the relationship rows.
    const subjectPub = subjectRow.publisher;
    const sameUniverse = subjectPub
      ? rosterClean.filter((h) => h.publisher === subjectPub && !seen.has(h.id)).slice(0, 12)
      : [];

    // Dream matches — top icons from the *other* major universe (rivals only excluded).
    const subjectKey = pubKey(subjectPub);
    const wantsDc = subjectKey === 'marvel';
    const wantsMarvel = subjectKey === 'dc';
    const rivalIds = new Set(rivals.map((r) => r.id));
    const dreamMatches = rosterClean
      .filter((h) => {
        if (rivalIds.has(h.id)) return false;
        const k = pubKey(h.publisher);
        if (wantsDc) return k === 'dc';
        if (wantsMarvel) return k === 'marvel';
        return k === 'marvel' || k === 'dc'; // subject is neither → both majors
      })
      .slice(0, 12);

    const similar = (similarRaw ?? []).filter((r) => !rivalIds.has(r.id) && !isSelf(r.name));

    return { subject, rivals, friendlyFire, family, sameUniverse, dreamMatches, similar, all };
  }, [subjectRow, roster, relations, similarRaw, hero, fallbackName]);

  return { ...(derived ?? EMPTY), loading: !derived };
}
