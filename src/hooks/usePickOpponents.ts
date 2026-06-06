import { useEffect, useState } from 'react';
import { searchHeroes, getHeroById, getHeroesByIds, getHeroesByPowerRange } from '../lib/db/heroes';
import type { HeroSearchResult, HeroPowerResult } from '../lib/db/heroes';
import { getRivals } from '../constants/rivals';

export interface PickSubject {
  id: string;
  name: string;
  image_url: string | null;
  portrait_url: string | null;
}

export interface PickOpponents {
  /** The hero we're choosing an opponent for (for the context anchor). */
  subject: PickSubject | null;
  rivals: HeroSearchResult[];
  sameUniverse: HeroSearchResult[];
  similar: HeroPowerResult[];
  /** Every other hero, portrait-first, for the full grid + search. */
  all: HeroSearchResult[];
  loading: boolean;
}

/**
 * Single source of truth for the opponent-picker screen.
 *
 * The roster (`all`) is a popularity-ranked slice for browsing/search, but the
 * subject and its rivals are resolved **by ID** — many canonical heroes have a
 * null `issue_count` and would otherwise fall outside that slice, silently
 * dropping the anchor's publisher and whole rival rail. Same-name duplicates
 * (the dataset has e.g. two Batmans) are filtered so a hero never faces itself.
 */
export function usePickOpponents(hero: string, fallbackName?: string): PickOpponents {
  const [subject, setSubject] = useState<PickSubject | null>(null);
  const [all, setAll] = useState<HeroSearchResult[]>([]);
  const [rivals, setRivals] = useState<HeroSearchResult[]>([]);
  const [sameUniverse, setSameUniverse] = useState<HeroSearchResult[]>([]);
  const [similar, setSimilar] = useState<HeroPowerResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const rivalIds = getRivals(hero ?? '');
    const rivalIdSet = new Set(rivalIds);

    // Roster for the grid + search (popularity-ranked is the right order here).
    const rosterP = searchHeroes('', 'All', 600);
    // Subject + rivals by ID so they resolve regardless of issue_count.
    const subjectP = getHeroById(hero ?? '');
    const rivalsP = getHeroesByIds(rivalIds);

    Promise.all([subjectP, rivalsP, rosterP])
      .then(([subjectRow, rivalRows, allHeroes]) => {
        if (cancelled) return;

        const subjectName = subjectRow?.name ?? fallbackName ?? 'this hero';
        setSubject({
          id: hero,
          name: subjectName,
          image_url: subjectRow?.image_url ?? null,
          portrait_url: subjectRow?.portrait_url ?? null,
        });

        // Never let a hero face a same-name duplicate of itself.
        const isSelf = (name: string | null) =>
          !!name && name.toLowerCase() === subjectName.toLowerCase();

        setRivals(rivalRows.filter((r) => r.id !== hero && !isSelf(r.name)));

        const roster = allHeroes.filter((h) => h.id !== hero && !isSelf(h.name));
        // Portrait first, then any image, then neither — best art leads.
        setAll(
          [...roster].sort((a, b) => {
            const scoreA = a.portrait_url ? 2 : a.image_url ? 1 : 0;
            const scoreB = b.portrait_url ? 2 : b.image_url ? 1 : 0;
            return scoreB - scoreA;
          }),
        );

        const publisher = subjectRow?.publisher;
        if (publisher) {
          setSameUniverse(
            roster.filter((h) => h.publisher === publisher && !rivalIdSet.has(h.id)).slice(0, 10),
          );
        }

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
            setSimilar(results.filter((r) => !rivalIdSet.has(r.id) && !isSelf(r.name)));
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

  return { subject, rivals, sameUniverse, similar, all, loading };
}
