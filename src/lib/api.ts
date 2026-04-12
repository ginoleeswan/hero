import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { HeroStats, HeroDetails, FirstIssue } from '../types';

const SUPERHERO_API_KEY = Constants.expoConfig?.extra?.superheroApiKey as string;
const COMICVINE_API_KEY = Constants.expoConfig?.extra?.comicvineApiKey as string;

const SUPERHERO_BASE = 'https://superheroapi.com/api';
const COMICVINE_BASE = 'https://comicvine.gamespot.com/api';
const CDN_BASE = 'https://cdn.jsdelivr.net/gh/akabab/superhero-api@0.3.0/api/id';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';

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
  if (Platform.OS === 'web') return { summary: null, publisher: null, firstIssueId: null, powers: null };

  const params = new URLSearchParams({
    api_key: COMICVINE_API_KEY,
    format: 'json',
    filter: `name:${heroName}`,
    field_list: 'id,deck,publisher,first_appeared_in_issue',
    limit: '1',
  });

  const res = await fetch(`${COMICVINE_BASE}/characters/?${params}`);
  if (!res.ok) throw new Error(`ComicVine error: ${res.status}`);
  const json = await res.json();
  const result = json.results?.[0];

  if (!result) return { summary: null, publisher: null, firstIssueId: null, powers: null };

  // Fetch powers from the detail endpoint — the list endpoint doesn't return associations
  let powers: string[] | null = null;
  if (result.id) {
    const detailParams = new URLSearchParams({
      api_key: COMICVINE_API_KEY,
      format: 'json',
      field_list: 'powers',
    });
    const detailRes = await fetch(`${COMICVINE_BASE}/character/4005-${result.id}/?${detailParams}`);
    if (detailRes.ok) {
      const detailJson = await detailRes.json();
      const rawPowers = Array.isArray(detailJson.results?.powers)
        ? detailJson.results.powers
            .map((p: unknown) => (p && typeof (p as Record<string, unknown>).name === 'string' ? (p as Record<string, unknown>).name as string : null))
            .filter((n): n is string => n !== null)
        : [];
      powers = rawPowers.length > 0 ? rawPowers : null;
    }
  }

  return {
    summary: result.deck ?? null,
    publisher: result.publisher?.name ?? null,
    firstIssueId: result.first_appeared_in_issue?.id
      ? String(result.first_appeared_in_issue.id)
      : null,
    powers,
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-verdict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify(input),
      signal: controller.signal,
    });

    if (!res.ok) return verdictFallback(input);

    const data = (await res.json()) as { verdict?: string };
    return data.verdict?.trim() || verdictFallback(input);
  } catch {
    return verdictFallback(input);
  } finally {
    clearTimeout(timeout);
  }
}
