// Hero as stored in Supabase
export interface Hero {
  id: string;
  name: string;
  publisher: string | null;
  image_url: string | null;  // local asset key, e.g. 'spiderman'
  category: 'popular' | 'villain' | 'xmen';
}

// SuperheroAPI response
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

// ComicVine character response (parsed)
export interface HeroDetails {
  summary: string | null;
  publisher: string | null;
  firstIssueId: string | null;
}

// ComicVine first issue response (parsed)
export interface FirstIssue {
  id: string;
  imageUrl: string | null;
}

// Combined character data for the character screen
export interface CharacterData {
  stats: HeroStats;
  details: HeroDetails;
  firstIssue: FirstIssue | null;
}
