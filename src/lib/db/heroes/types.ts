import type { Tables } from '../../../types/database.generated';

export type Hero = Tables<'heroes'>;

/**
 * What a hero-row fetch actually returns: every column except the biography
 * HTML, plus the `has_description` computed field that replaced it.
 *
 * Typed separately from `Hero` on purpose. Claiming `description` on a row that
 * doesn't carry it is exactly the kind of lie that typechecks and then fails at
 * runtime — `hero.description` would read `undefined`, every biography would
 * look absent, and nothing would complain. See `src/lib/db/heroes/columns.ts`
 * for why the column is left out, and `getHeroBiography` for how the screen
 * that needs it gets it.
 */
export type HeroRow = Omit<Hero, 'description'> & {
  /**
   * Optional because React Query serves list-cache rows as placeholder data
   * while the real row loads (`findCachedHero`), and those were selected by
   * browse queries that never asked for the computed field. Consumers default
   * it to false — a biography link that appears a moment late is fine; a crash
   * on a placeholder is not.
   */
  has_description?: boolean;
};
export type HeroCategory = 'popular' | 'villain' | 'xmen';
export type PublisherFilter = 'All' | 'Marvel' | 'DC' | 'Other';
export type AlignmentFilter = 'All' | 'Heroes' | 'Villains' | 'Anti';

export type HeroSearchResult = Pick<
  Hero,
  | 'id'
  | 'name'
  | 'publisher'
  | 'alignment'
  | 'image_md_url'
  | 'image_url'
  | 'portrait_url'
  // Returned by search_heroes so result rows — all of which are circular — can
  // show the flat head instead of cropping a portrait into a circle.
  | 'avatar_url'
  | 'full_name'
  | 'aliases'
  | 'fame_score'
>;

export interface FirstAppearanceCover {
  id: string;
  name: string;
  first_appearance: string | null;
  first_issue_image_url: string | null;
}

export interface EraHero {
  id: string;
  name: string;
  image_url: string | null;
  portrait_url: string | null;
  year: number;
}

export interface EraBucket {
  era: string;
  heroes: EraHero[];
}

export type CategorySlug =
  | 'popular'
  | 'villain'
  | 'xmen'
  | 'anti-heroes'
  | 'marvel'
  | 'dc'
  | 'image'
  | 'dark-horse'
  | 'strongest'
  | 'most-intelligent'
  | 'most-iconic'
  | 'franchise-icons'
  | 'anime'
  | 'video-games'
  | 'horror'
  | 'magic'
  | 'aliens'
  | 'mythology';

export type SortOption = 'popular' | 'az' | 'power';
export type CategoryPublisher = 'all' | 'marvel' | 'dc';

export interface BrowseCover {
  name: string;
  image_url: string | null;
  image_md_url: string | null;
  portrait_url: string | null;
}

export type HeroPowerResult = Pick<
  Hero,
  'id' | 'name' | 'publisher' | 'image_url' | 'portrait_url'
>;

export type RelatedHeroCard = Pick<
  Hero,
  'id' | 'name' | 'image_url' | 'image_md_url' | 'portrait_url' | 'publisher' | 'alignment'
> & {
  /**
   * The flat head icon, where the producer bothered to select it — the
   * get_related_heroes RPC does not, while getTitleHeroes does. Optional twice
   * over, since only the famous tier has one at all, so every consumer has to
   * degrade rather than assume.
   */
  avatar_url?: string | null;
};

/** A hero-to-hero association grouping. Extend in lockstep with the DB `kind`s. */
export type RelationKind = 'enemy' | 'ally' | 'teammate';

export interface FearedVillain {
  id: string;
  name: string;
  image_url: string | null;
  image_md_url: string | null;
  portrait_url: string | null;
  publisher: string | null;
  alignment: string | null;
  fearedBy: number;
}

export interface HeroRelationship {
  isEnemy: boolean;
  isAlly: boolean;
  isTeammate: boolean;
  isCurated: boolean;
  crossUniverse: boolean;
  familyRelation: string | null;
}

export type RelationshipTone = 'rivalry' | 'family' | 'team' | 'ally' | 'dream';

export interface Rivalry {
  a: { id: string; name: string; image_url: string | null; portrait_url: string | null };
  b: { id: string; name: string; image_url: string | null; portrait_url: string | null };
  crossUniverse: boolean;
}

export interface PublisherCounts {
  marvel: number;
  dc: number;
  other: number;
}
