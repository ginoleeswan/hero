import type { Tables } from './database.generated';

// ─── DB types (derived from generated schema — do not redefine) ───────────────

export type Hero = Tables<'heroes'>;
export type UserFavourite = Tables<'user_favourites'>;
export type UserProfile = Tables<'user_profiles'>;
export type HeroNarrativeFact = Tables<'hero_narrative_facts'>;
export type HeroTag = Tables<'hero_tags'>;
export type HeroTagVocab = Tables<'hero_tag_vocab'>;
export type Team = Tables<'teams'>;
export type TeamMember = Tables<'team_members'>;

// Narrowed category type (DB stores as string, but we know the valid values)
export type HeroCategory = 'popular' | 'villain' | 'xmen';

// Shared hero projection used by favourites and view history
export type FavouriteHero = Pick<Hero, 'id' | 'name' | 'image_url' | 'portrait_url'>;

// ─── SuperheroAPI response types ─────────────────────────────────────────────

export interface HeroStats {
  id: string;
  name: string;
  powerstats: {
    intelligence: string;
    strength: string;
    speed: string;
    durability: string;
    power: string;
    combat: string;
  };
  biography: {
    'full-name': string;
    'alter-egos': string;
    aliases: string[];
    'place-of-birth': string;
    'first-appearance': string;
    publisher: string;
    alignment: string;
  };
  appearance: {
    gender: string;
    race: string;
    height: string[];
    weight: string[];
    'eye-color': string;
    'hair-color': string;
  };
  work: {
    occupation: string;
    base: string;
  };
  connections: {
    'group-affiliation': string;
    relatives: string;
  };
  image: {
    url: string;
    portraitUrl: string | null;
  };
}

// ─── ComicVine response types (parsed) ───────────────────────────────────────

export interface MovieAppearance {
  name: string;
  year: string | null;
  imageUrl: string | null;
  url?: string | null;
  rating?: string | null;
  runtime?: string | null;
  deck?: string | null;
  totalRevenue?: string | null;
}

export interface HeroDetails {
  summary: string | null;
  publisher: string | null;
  firstIssueId: string | null;
  firstIssueData: FirstIssue | null;
  powers: string[] | null;
  description: string | null;
  origin: string | null;
  issueCount: number | null;
  creators: string[] | null;
  enemies: string[] | null;
  friends: string[] | null;
  movies: MovieAppearance[] | null;
  movieCount: number | null;
  teams: string[] | null;
}

export interface FirstIssue {
  id: string;
  imageUrl: string | null;
  name: string | null;
  coverDate: string | null;
  storeDate: string | null;
  issueNumber: string | null;
  deck: string | null;
  seriesName: string | null;
  personCredits: string[] | null;
  debutCharacters: string[] | null;
}

export interface IssueCover {
  url: string;
  name: string | null;
  issueNumber: string | null;
  year: string | null;
  /** ComicVine issue id (null until the gallery is id-backfilled). Present →
   *  the cover opens the /issue/[id] read-through page instead of the lightbox. */
  id: string | null;
}

export interface HeroImage {
  url: string;
  caption: string | null;
  /** 'comicvine_primary' | 'comicvine_cover' | 'ai' | 'curated' */
  source: string;
  /** ComicVine issue id (covers only) → opens /issue/cvi:<id> read-through. */
  issueId: string | null;
}

// ─── Combined character screen data ──────────────────────────────────────────

export type StatsSource = 'superheroapi' | 'ai' | null;

export interface CharacterData {
  stats: HeroStats;
  details: HeroDetails;
  firstIssue: FirstIssue | null;
  statsSource?: StatsSource;
}
