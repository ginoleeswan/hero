import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { HeroStats, HeroDetails, FirstIssue } from '../types';
import { supabase } from './supabase';

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

export async function fetchHeroDetails(heroId: string, heroName: string): Promise<HeroDetails> {
  const { data, error } = await supabase.functions.invoke<{
    summary: string | null;
    publisher: string | null;
    firstIssueId: string | null;
    powers: string[] | null;
  }>('get-comicvine-hero', { body: { heroId, heroName } });

  if (error) console.warn('[fetchHeroDetails] error:', error.message, error);
  if (error || !data) return { summary: null, publisher: null, firstIssueId: null, powers: null };

  return {
    summary: data.summary ?? null,
    publisher: data.publisher ?? null,
    firstIssueId: data.firstIssueId ?? null,
    powers: data.powers ?? null,
  };
}

export async function fetchFirstIssue(issueId: string): Promise<FirstIssue> {
  const params = new URLSearchParams({
    api_key: COMICVINE_API_KEY,
    format: 'json',
    field_list: 'id,image,name,cover_date,issue_number',
  });

  const res = await fetch(`${COMICVINE_BASE}/issue/4000-${issueId}/?${params}`);
  if (!res.ok) throw new Error(`ComicVine issue error: ${res.status}`);
  const json = await res.json();
  const result = json.results;

  return {
    id: issueId,
    imageUrl: result?.image?.medium_url ?? null,
    name: result?.name ?? null,
    coverDate: result?.cover_date ?? null,
    issueNumber: result?.issue_number ?? null,
  };
}

export interface VerdictInput {
  heroA: string;
  heroB: string;
  winsA: number;
  winsB: number;
  statsA: Record<string, number>;
  statsB: Record<string, number>;
}

function verdictFallback(input: VerdictInput): string {
  const { heroA, heroB, winsA, winsB } = input;
  if (winsA === winsB) return `${heroA} and ${heroB} are evenly matched — ${winsA} stats each.`;
  const winner = winsA > winsB ? heroA : heroB;
  const wins = Math.max(winsA, winsB);
  return `${winner} takes it — ${wins} of 6 stats.`;
}

export async function generateVerdict(input: VerdictInput): Promise<string> {
  try {
    const { data, error } = await Promise.race([
      supabase.functions.invoke<{ verdict?: string }>('generate-verdict', { body: input }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
    ]);
    if (error || !data) return verdictFallback(input);
    return data.verdict?.trim() || verdictFallback(input);
  } catch {
    return verdictFallback(input);
  }
}
