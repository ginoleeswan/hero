import type { UniverseResult } from '../db/universes';
import type { TeamSearchResult } from '../db/teams';
import type { HeroSearchResult } from '../db/heroes';
import type { TitleSearchResult } from '../db/titles';

// The single best match across all result types — the prominent "Top result" row
// at the top of the palette (Raycast/Spotlight pattern).
export type TopResult =
  | { kind: 'universe'; universe: UniverseResult }
  | { kind: 'team'; team: TeamSearchResult }
  | { kind: 'hero'; hero: HeroSearchResult }
  | { kind: 'title'; title: TitleSearchResult };

export interface TopResultSources {
  universes: UniverseResult[];
  teams: TeamSearchResult[];
  heroes: HeroSearchResult[];
  titles: TitleSearchResult[];
}

const norm = (s: string) => s.toLowerCase().replace(/[\s\-_.]/g, '');

/**
 * Pick the one result to feature at the top. Characters are the primary content,
 * so the fame-ranked top hero wins by default — EXCEPT where the query clearly
 * names a grouping or a title:
 *   exact universe  >  exact team  >  exact title (only if the top hero is weak)
 *   >  top hero  >  first of the rest.
 * "disney"→Disney, "avengers"→Avengers(team), "spider"→Spider-Man, "the boys"→show.
 */
export function pickTopResult(query: string, sources: TopResultSources): TopResult | null {
  const q = norm(query);
  if (!q) return null;
  const { universes, teams, heroes, titles } = sources;

  const exactUniverse = universes.find((u) => u.exact);
  if (exactUniverse) return { kind: 'universe', universe: exactUniverse };

  const exactTeam = teams.find((t) => norm(t.name) === q);
  if (exactTeam) return { kind: 'team', team: exactTeam };

  const topHero = heroes[0];
  const heroStrong = topHero ? norm(topHero.name) === q || norm(topHero.name).startsWith(q) : false;

  const exactTitle = titles.find((t) => norm(t.title) === q);
  if (exactTitle && !heroStrong) return { kind: 'title', title: exactTitle };

  if (topHero) return { kind: 'hero', hero: topHero };
  if (universes[0]) return { kind: 'universe', universe: universes[0] };
  if (teams[0]) return { kind: 'team', team: teams[0] };
  if (titles[0]) return { kind: 'title', title: titles[0] };
  return null;
}

/** Stable `kind:id` key so a section can drop the item that's already featured. */
export function topResultKey(top: TopResult): string {
  switch (top.kind) {
    case 'universe':
      return `universe:${top.universe.slug}`;
    case 'team':
      return `team:${top.team.id}`;
    case 'hero':
      return `hero:${top.hero.id}`;
    case 'title':
      return `title:${top.title.id}`;
  }
}
