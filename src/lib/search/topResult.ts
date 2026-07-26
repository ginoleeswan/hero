import type { UniverseResult } from '../db/universes';
import type { TeamSearchResult } from '../db/teams';
import type { HeroSearchResult } from '../db/heroes';
import type { TitleSearchResult } from '../db/titles';
import type { HouseSearchResult } from '../db/houses';

// The single best match across all result types — the prominent "Top result" row
// at the top of the palette (Raycast/Spotlight pattern).
export type TopResult =
  | { kind: 'universe'; universe: UniverseResult }
  | { kind: 'team'; team: TeamSearchResult }
  | { kind: 'hero'; hero: HeroSearchResult }
  | { kind: 'title'; title: TitleSearchResult }
  | { kind: 'house'; house: HouseSearchResult };

export interface TopResultSources {
  universes: UniverseResult[];
  teams: TeamSearchResult[];
  heroes: HeroSearchResult[];
  titles: TitleSearchResult[];
  houses?: HouseSearchResult[];
}

const norm = (s: string) => s.toLowerCase().replace(/[\s\-_.]/g, '');

// A hero is only featured as THE answer when it's a confident winner: an exact
// name match, or a prefix match on a FAMOUS hero. This stops obscure prefix
// matches (e.g. "end" → "Endless Winter") from being presented as the top result.
const HERO_TOP_FAME_MIN = 50;

/**
 * Pick the one result to feature at the top — ONLY when we're confident it's the
 * answer, so vague fragments don't get a presumptuous guess. Priority:
 *   exact universe  >  exact team  >  exact title (no confident hero)  >
 *   confident hero (exact name, or famous prefix).
 * Returns null when nothing is a confident winner — the palette then just shows
 * the grouped sections. "disney"→Disney, "avengers"→Avengers(team), "bat"→Batman,
 * "the dark knight"→film, "end"→(no top result).
 */
export function pickTopResult(query: string, sources: TopResultSources): TopResult | null {
  const q = norm(query);
  if (!q) return null;
  const { universes, teams, heroes, titles, houses } = sources;

  const exactUniverse = universes.find((u) => u.exact);
  if (exactUniverse) return { kind: 'universe', universe: exactUniverse };

  // A bare surname is an exact house hit ("targaryen" → House Targaryen), and it
  // beats the fifty-five characters who also match it — the dynasty is what the
  // word names. It sits below universes so "game of thrones" still wins its own.
  const exactHouse = houses?.find((h) => h.exact);
  if (exactHouse) return { kind: 'house', house: exactHouse };

  const exactTeam = teams.find((t) => norm(t.name) === q);
  if (exactTeam) return { kind: 'team', team: exactTeam };

  const topHero = heroes[0];
  const heroName = topHero ? norm(topHero.name) : '';
  const heroExact = !!topHero && heroName === q;
  const heroFamousPrefix =
    !!topHero && heroName.startsWith(q) && (topHero.fame_score ?? 0) >= HERO_TOP_FAME_MIN;
  const heroConfident = heroExact || heroFamousPrefix;

  const exactTitle = titles.find((t) => norm(t.title) === q);
  if (exactTitle && !heroConfident) return { kind: 'title', title: exactTitle };

  if (heroConfident && topHero) return { kind: 'hero', hero: topHero };
  return null;
}

/** Stable `kind:id` key so a section can drop the item that's already featured. */
export function topResultKey(top: TopResult): string {
  switch (top.kind) {
    case 'universe':
      return `universe:${top.universe.slug}`;
    case 'house':
      return `house:${top.house.slug}`;
    case 'team':
      return `team:${top.team.id}`;
    case 'hero':
      return `hero:${top.hero.id}`;
    case 'title':
      return `title:${top.title.id}`;
  }
}
