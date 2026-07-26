import type { Tables } from '../../../types/database.generated';

export type Hero = Tables<'heroes'>;
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
  | 'horror';

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
