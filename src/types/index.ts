import type { Tables } from './database.generated';

// ─── DB types (derived from generated schema — do not redefine) ───────────────

export type Hero = Tables<'heroes'>;
export type UserFavourite = Tables<'user_favourites'>;
export type UserProfile = Tables<'user_profiles'>;

// Narrowed category type (DB stores as string, but we know the valid values)
export type HeroCategory = 'popular' | 'villain' | 'xmen';

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
  };
}

// ─── ComicVine response types (parsed) ───────────────────────────────────────

export interface HeroDetails {
  summary: string | null;
  publisher: string | null;
  firstIssueId: string | null;
}

export interface FirstIssue {
  id: string;
  imageUrl: string | null;
}

// ─── Combined character screen data ──────────────────────────────────────────

export interface CharacterData {
  stats: HeroStats;
  details: HeroDetails;
  firstIssue: FirstIssue | null;
}
