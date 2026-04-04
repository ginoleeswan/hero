import Constants from 'expo-constants';
import type { HeroStats, HeroDetails, FirstIssue } from '../types';

const SUPERHERO_API_KEY = Constants.expoConfig?.extra?.superheroApiKey as string;
const COMICVINE_API_KEY = Constants.expoConfig?.extra?.comicvineApiKey as string;

const SUPERHERO_BASE = 'https://superheroapi.com/api';
const COMICVINE_BASE = 'https://comicvine.gamespot.com/api';

export async function fetchHeroStats(heroId: string): Promise<HeroStats> {
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
