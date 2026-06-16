import { useEffect, useState } from 'react';
import {
  searchHeroes,
  getHeroById,
  getRelatedHeroes,
  getFamilyOpponents,
  getHeroesByPowerRange,
} from '../lib/db/heroes';
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

/**
 * Single source of truth for the opponent-picker screen — a "matchup menu" of
 * distinct reasons to fight, each drawn from the relationship graphs and the
 * roster. Rows are resolved/ranked upstream; cross-row de-duping keeps a hero in
 * its most dramatic row only.
 */
export function usePickOpponents(hero: string, fallbackName?: string): PickOpponents {
  const [subject, setSubject] = useState<PickSubject | null>(null);
  const [all, setAll] = useState<HeroSearchResult[]>([]);
  const [rivals, setRivals] = useState<RelatedHeroCard[]>([]);
  const [friendlyFire, setFriendlyFire] = useState<RelatedHeroCard[]>([]);
  const [family, setFamily] = useState<RelatedHeroCard[]>([]);
  const [sameUniverse, setSameUniverse] = useState<HeroSearchResult[]>([]);
  const [dreamMatches, setDreamMatches] = useState<HeroSearchResult[]>([]);
  const [similar, setSimilar] = useState<HeroPowerResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const rosterP = searchHeroes('', 'All', 600);
    const subjectP = getHeroById(hero ?? '');
    const rivalsP = hero
      ? getRelatedHeroes(hero, 'enemy', { sameUniverse: true, limit: 40 })
      : Promise.resolve([] as RelatedHeroCard[]);
    const teammatesP = hero
      ? getRelatedHeroes(hero, 'teammate', { sameUniverse: true, limit: 24 })
      : Promise.resolve([] as RelatedHeroCard[]);
    const alliesP = hero
      ? getRelatedHeroes(hero, 'ally', { sameUniverse: true, limit: 24 })
      : Promise.resolve([] as RelatedHeroCard[]);
    const familyP = hero ? getFamilyOpponents(hero, 24) : Promise.resolve([] as RelatedHeroCard[]);

    Promise.all([subjectP, rosterP, rivalsP, teammatesP, alliesP, familyP])
      .then(([subjectRow, allHeroes, dbRivals, teammates, allies, familyRows]) => {
        if (cancelled) return;

        const subjectName = subjectRow?.name ?? fallbackName ?? 'this hero';
        setSubject({
          id: hero,
          name: subjectName,
          image_url: subjectRow?.image_url ?? null,
          portrait_url: subjectRow?.portrait_url ?? null,
        });

        const isSelf = (name: string | null) =>
          !!name && name.toLowerCase() === subjectName.toLowerCase();

        // Rivals lead.
        const seen = new Set<string>();
        const keep = (r: { id: string; name: string }) => {
          if (r.id === hero || isSelf(r.name) || seen.has(r.id)) return false;
          seen.add(r.id);
          return true;
        };
        const mergedRivals = dbRivals.filter(keep);
        setRivals(mergedRivals);

        // Friendly fire — allies + teammates, minus anyone already a rival.
        const ff = [...teammates, ...allies].filter(keep);
        setFriendlyFire(ff);

        // Bloodline — family is its own table; only exclude self/dupes.
        const famSeen = new Set<string>();
        const fam = familyRows.filter((r) => {
          if (r.id === hero || isSelf(r.name) || famSeen.has(r.id)) return false;
          famSeen.add(r.id);
          return true;
        });
        setFamily(fam);
        for (const f of fam) seen.add(f.id); // keep family out of the generic rows

        const roster = allHeroes.filter((h) => h.id !== hero && !isSelf(h.name));
        setAll(
          [...roster].sort((a, b) => {
            const scoreA = a.portrait_url ? 2 : a.image_url ? 1 : 0;
            const scoreB = b.portrait_url ? 2 : b.image_url ? 1 : 0;
            return scoreB - scoreA;
          }),
        );

        // Same universe — same publisher, minus the relationship rows.
        const subjectPub = subjectRow?.publisher;
        if (subjectPub) {
          setSameUniverse(
            roster.filter((h) => h.publisher === subjectPub && !seen.has(h.id)).slice(0, 12),
          );
        }

        // Dream matches — top icons from the *other* major universe.
        const subjectKey = pubKey(subjectPub);
        const wantsDc = subjectKey === 'marvel';
        const wantsMarvel = subjectKey === 'dc';
        const rivalIds = new Set(mergedRivals.map((r) => r.id));
        setDreamMatches(
          roster
            .filter((h) => {
              if (rivalIds.has(h.id)) return false;
              const k = pubKey(h.publisher);
              if (wantsDc) return k === 'dc';
              if (wantsMarvel) return k === 'marvel';
              return k === 'marvel' || k === 'dc'; // subject is neither → both majors
            })
            .slice(0, 12),
        );

        if (subjectRow?.enriched_at) {
          const total =
            (subjectRow.intelligence ?? 0) +
            (subjectRow.strength ?? 0) +
            (subjectRow.speed ?? 0) +
            (subjectRow.durability ?? 0) +
            (subjectRow.power ?? 0) +
            (subjectRow.combat ?? 0);
          const margin = Math.round(total * 0.18);
          getHeroesByPowerRange(total - margin, total + margin, hero ?? '').then((results) => {
            if (cancelled) return;
            setSimilar(results.filter((r) => !rivalIds.has(r.id) && !isSelf(r.name)));
          });
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) console.warn('[usePickOpponents] Failed to load heroes:', e);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hero, fallbackName]);

  return {
    subject,
    rivals,
    friendlyFire,
    family,
    sameUniverse,
    dreamMatches,
    similar,
    all,
    loading,
  };
}
