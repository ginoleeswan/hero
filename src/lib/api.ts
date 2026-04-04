import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { HeroStats, HeroDetails, FirstIssue } from '../types';

const SUPERHERO_API_KEY = Constants.expoConfig?.extra?.superheroApiKey as string;
const COMICVINE_API_KEY = Constants.expoConfig?.extra?.comicvineApiKey as string;

const SUPERHERO_BASE = 'https://superheroapi.com/api';
const COMICVINE_BASE = 'https://comicvine.gamespot.com/api';
const CDN_BASE = 'https://cdn.jsdelivr.net/gh/akabab/superhero-api@0.3.0/api/id';

// CDN response shape (camelCase, numeric powerstats)
interface CdnHeroStats {
  id: number;
  name: string;
  powerstats: Record<string, number>;
  biography: {
    fullName: string;
    alterEgos: string;
    aliases: string[];
    placeOfBirth: string;
    firstAppearance: string;
    publisher: string;
    alignment: string;
  };
  appearance: {
    gender: string;
    race: string;
    height: string[];
    weight: string[];
    eyeColor: string;
    hairColor: string;
  };
  work: { occupation: string; base: string };
  connections: { groupAffiliation: string; relatives: string };
  images: { md: string };
}

function cdnToHeroStats(d: CdnHeroStats): HeroStats {
  return {
    id: String(d.id),
    name: d.name,
    powerstats: {
      intelligence: String(d.powerstats.intelligence ?? 0),
      strength: String(d.powerstats.strength ?? 0),
      speed: String(d.powerstats.speed ?? 0),
      durability: String(d.powerstats.durability ?? 0),
      power: String(d.powerstats.power ?? 0),
      combat: String(d.powerstats.combat ?? 0),
    },
    biography: {
      'full-name': d.biography.fullName,
      'alter-egos': d.biography.alterEgos,
      aliases: d.biography.aliases,
      'place-of-birth': d.biography.placeOfBirth,
      'first-appearance': d.biography.firstAppearance,
      publisher: d.biography.publisher,
      alignment: d.biography.alignment,
    },
    appearance: {
      gender: d.appearance.gender,
      race: d.appearance.race,
      height: d.appearance.height,
      weight: d.appearance.weight,
      'eye-color': d.appearance.eyeColor,
      'hair-color': d.appearance.hairColor,
    },
    work: d.work,
    connections: {
      'group-affiliation': d.connections.groupAffiliation,
      relatives: d.connections.relatives,
    },
    image: { url: d.images.md },
  };
}

export async function fetchHeroStats(heroId: string): Promise<HeroStats> {
  if (Platform.OS === 'web') {
    const res = await fetch(`${CDN_BASE}/${heroId}.json`);
    if (!res.ok) throw new Error(`CDN hero not found: ${heroId}`);
    const data: CdnHeroStats = await res.json();
    return cdnToHeroStats(data);
  }
  const res = await fetch(`${SUPERHERO_BASE}/${SUPERHERO_API_KEY}/${heroId}`);
  if (!res.ok) throw new Error(`SuperheroAPI error: ${res.status}`);
  const data = await res.json();
  if (data.response === 'error') throw new Error(data.error ?? 'Hero not found');
  return data as HeroStats;
}

export async function fetchHeroDetails(heroName: string): Promise<HeroDetails> {
  const params = new URLSearchParams({
    api_key: COMICVINE_API_KEY,
    format: 'json',
    filter: `name:${heroName}`,
    field_list: 'deck,publisher,first_appeared_in_issue',
    limit: '1',
  });

  const res = await fetch(`${COMICVINE_BASE}/characters/?${params}`);
  if (!res.ok) throw new Error(`ComicVine error: ${res.status}`);
  const json = await res.json();
  const result = json.results?.[0];

  if (!result) return { summary: null, publisher: null, firstIssueId: null };

  return {
    summary: result.deck ?? null,
    publisher: result.publisher?.name ?? null,
    firstIssueId: result.first_appeared_in_issue?.id
      ? String(result.first_appeared_in_issue.id)
      : null,
  };
}

export async function fetchFirstIssue(issueId: string): Promise<FirstIssue> {
  const params = new URLSearchParams({
    api_key: COMICVINE_API_KEY,
    format: 'json',
    field_list: 'id,image',
  });

  const res = await fetch(`${COMICVINE_BASE}/issue/4000-${issueId}/?${params}`);
  if (!res.ok) throw new Error(`ComicVine issue error: ${res.status}`);
  const json = await res.json();
  const result = json.results;

  return {
    id: issueId,
    imageUrl: result?.image?.medium_url ?? null,
  };
}
