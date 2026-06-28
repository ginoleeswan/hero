// src/lib/query/titleCache.ts
// Pre-seed helper for the title detail screen — the title-side sibling of
// heroCache's findCachedHero. When you tap a recommendation, that row already
// carries { id, title, posterUrl, year }; this scans the cached recs/collection
// lists for it and returns a stub HeroTitle so the header paints instantly while
// the full row fetches. Wired as `placeholderData` on useTitle.
import type { QueryClient } from '@tanstack/react-query';
import { parseTitleId, type HeroTitle, type TitleSource } from '../db/titles';
import type { TitleRecommendation } from '../tmdb/extras';

/** Build a partial HeroTitle from a recommendation row — known fields set, the
 *  rest null until the real fetch lands (header shows poster + title + year). */
export function titleStub(rec: TitleRecommendation): HeroTitle {
  const { source, externalId } = parseTitleId(rec.id);
  return {
    id: rec.id,
    source: (source as TitleSource) || 'tmdb',
    mediaType: 'film',
    externalId,
    title: rec.title,
    year: rec.year,
    posterUrl: rec.posterUrl,
    backdropUrl: null,
    voteAverage: null,
    runtime: null,
    overview: null,
    trailerKey: null,
    watchProviders: null,
    cast: null,
    stills: null,
    revenue: null,
    details: null,
  };
}

/** Scan every cached recs/collection list for this title id, returning a stub. */
export function findCachedTitle(client: QueryClient, id: string): HeroTitle | undefined {
  const lists = [
    ...client.getQueriesData<TitleRecommendation[]>({ queryKey: ['titles', 'recs'] }),
    ...client.getQueriesData<TitleRecommendation[]>({ queryKey: ['titles', 'collection'] }),
  ];
  for (const [, data] of lists) {
    const hit = data?.find((r) => r.id === id);
    if (hit) return titleStub(hit);
  }
  return undefined;
}
